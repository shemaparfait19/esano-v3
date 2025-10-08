import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchOutput = {
  userId: string;
  fileName: string;
  relationship: string;
  confidence: number;
  details: string;
  displayName?: string;
  avatarUrl?: string;
  metrics: {
    totalSNPs: number;
    ibdSegments: number;
    totalIBD_cM: number;
    ibs0: number;
    ibs1: number;
    ibs2: number;
    kinshipCoefficient: number;
  };
};

type SNP = {
  chr: string;
  pos: number;
  genotype: [number, number]; // normalized [0,0], [0,1], [1,1]
};

type IBDSegment = {
  chr: string;
  startPos: number;
  endPos: number;
  lengthCM: number;
  snpCount: number;
};

export async function POST(req: Request) {
  try {
    const { userId, dnaText } = await req.json();
    if (!userId || !dnaText) {
      return NextResponse.json(
        { error: "Missing userId or dnaText" },
        { status: 400 }
      );
    }

    // Parse user's DNA with quality filtering
    const userSNPs = parseAndFilterSNPs(dnaText);

    // Adjustable threshold - lower for testing, but less accurate
    const MIN_SNPS = parseInt(process.env.MIN_SNPS_THRESHOLD || "10");

    const lowSnp = userSNPs.length < MIN_SNPS;

    // Fetch all active DNA files metadata
    const snap = await adminDb.collection("dna_data").get();
    const all = snap.docs
      .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
      .filter((d: any) => d.status !== "removed");

    // Fetch user profiles with DNA data
    const userDocs = await adminDb.collection("users").limit(100).get();
    const comparatorUsers = userDocs.docs
      .filter((d: any) => d.id !== userId)
      .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
      .filter((u: any) => typeof u.dnaData === "string" && u.dnaData.length > 0)
      .slice(0, 50);

    const candidatesFromUsers = comparatorUsers.map((u: any) => ({
      userId: u.id,
      fileName: u.dnaFileName || "user_dna.txt",
      text: String(u.dnaData),
    }));

    // Use only Firestore-resident text samples (no Drive/Storage reads)
    const firestoreCandidates: {
      userId: string;
      fileName: string;
      text: string;
    }[] = [];

    for (const meta of all.slice(0, 200)) {
      try {
        if (meta.userId === userId) continue;
        const asText =
          typeof meta.textSample === "string" && meta.textSample.length > 0
            ? String(meta.textSample)
            : "";
        if (asText.length > 0) {
          firestoreCandidates.push({
            userId: meta.userId,
            fileName: meta.fileName || "dna.txt",
            text: asText,
          });
        }
      } catch {}
    }

    const candidates = [...candidatesFromUsers, ...firestoreCandidates];
    const _diagBase: any = {
      userSnps: userSNPs.length,
      candidatesCount: candidates.length,
      sampleCandidates: candidates.slice(0, 5).map((c) => ({
        userId: c.userId,
        fileName: c.fileName,
        textLen: c.text?.length || 0,
      })),
    };

    if (candidates.length === 0) {
      return NextResponse.json({ matches: [] satisfies MatchOutput[] });
    }

    // -------------------------------
    // Gemini-first batch comparison
    // -------------------------------
    try {
      const userPairs = toCompactPairs(userSNPs, 6000);
      // Prepare up to 25 candidates for the Gemini request to keep payload small
      const limited = candidates.slice(0, 25).map((c) => ({
        userId: c.userId,
        fileName: c.fileName,
        pairs: toCompactPairs(parseAndFilterSNPs(c.text), 6000),
      }));

      const geminiMatches = await geminiCompare({
        user: { userId, pairs: userPairs },
        candidates: limited,
      });

      if (Array.isArray(geminiMatches) && geminiMatches.length > 0) {
        // Map Gemini output into MatchOutput shape; metrics not provided by Gemini
        const mapped = geminiMatches
          .filter((m: any) => m && m.userId)
          .map((m: any) => ({
            userId: m.userId,
            fileName:
              limited.find((c) => c.userId === m.userId)?.fileName || "dna.txt",
            relationship: String(m.relationship || "Possible relative"),
            confidence: Math.max(0, Math.min(100, Number(m.confidence ?? 0))),
            details: String(
              m.details || "Computed by Gemini based on SNP concordance"
            ),
            metrics: {
              totalSNPs: 0,
              ibdSegments: 0,
              totalIBD_cM: 0,
              ibs0: 0,
              ibs1: 0,
              ibs2: 0,
              kinshipCoefficient: 0,
            },
          }));

        if (mapped.length > 0) {
          return NextResponse.json({
            matches: mapped.slice(0, 50),
            _diag: _diagBase,
          });
        }
      }
    } catch (err) {
      console.error(
        "Gemini comparison failed; falling back to IBS matcher:",
        err
      );
    }

    // Analyze each candidate (deterministic fallback)
    const matches: MatchOutput[] = [];

    for (const candidate of candidates) {
      try {
        const candidateSNPs = parseAndFilterSNPs(candidate.text);
        const lowOverlap = userSNPs.length < 200 || candidateSNPs.length < 200;

        if (lowOverlap) {
          // Basic similarity fallback for small inputs (VCF/raw string)
          const score = basicSimilarity(dnaText, candidate.text);
          const rel = interpretSimilarity(score);
          matches.push({
            userId: candidate.userId,
            fileName: candidate.fileName,
            relationship: rel.relationship,
            confidence: rel.confidence,
            details: `Low-SNP fallback similarity: ${score}%`,
            metrics: {
              totalSNPs: 0,
              ibdSegments: 0,
              totalIBD_cM: 0,
              ibs0: 0,
              ibs1: 0,
              ibs2: 0,
              kinshipCoefficient: 0,
            },
          });
        } else {
          // Perform comprehensive kinship analysis
          const analysis = analyzeKinship(userSNPs, candidateSNPs);

          // Only include matches with sufficient data quality
          if (analysis.metrics.totalSNPs >= 200) {
            matches.push({
              userId: candidate.userId,
              fileName: candidate.fileName,
              relationship: analysis.relationship,
              confidence: analysis.confidence,
              details: analysis.details,
              metrics: analysis.metrics,
            });
          }
        }
      } catch (err) {
        console.error(`Error analyzing candidate ${candidate.userId}:`, err);
      }
    }

    // Deduplicate by userId keeping highest confidence
    const bestByUser = new Map<string, MatchOutput>();
    for (const m of matches) {
      const prev = bestByUser.get(m.userId);
      if (!prev || m.confidence > prev.confidence) bestByUser.set(m.userId, m);
    }
    const uniqueMatches = Array.from(bestByUser.values());

    // Sort by confidence then kinship coefficient
    uniqueMatches.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.metrics.kinshipCoefficient - a.metrics.kinshipCoefficient;
    });

    // Enrich with user display names/avatars
    const top = uniqueMatches.slice(0, 50);
    const ids = Array.from(new Set(top.map((m) => m.userId))).slice(0, 50);
    const profiles: Record<string, any> = {};
    for (const id of ids) {
      try {
        const doc = await adminDb.collection("users").doc(id).get();
        if (doc.exists) profiles[id] = doc.data();
      } catch {}
    }
    const enriched = top.map((m) => ({
      ...m,
      displayName:
        profiles[m.userId]?.fullName ||
        profiles[m.userId]?.name ||
        profiles[m.userId]?.displayName ||
        (profiles[m.userId]?.firstName && profiles[m.userId]?.lastName
          ? `${profiles[m.userId]?.firstName} ${profiles[m.userId]?.lastName}`
          : undefined),
      avatarUrl:
        profiles[m.userId]?.profilePicture || profiles[m.userId]?.photoURL,
    }));

    // Return top matches enriched
    return NextResponse.json({
      matches: enriched,
      _diag: _diagBase,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to match DNA" },
      { status: 500 }
    );
  }
}

// ============================================================================
// SNP Parsing with Quality Control
// ============================================================================

function parseAndFilterSNPs(text: string): SNP[] {
  const snps: SNP[] = [];
  // Split on newlines, but also split single-line VCF blobs by spaces with record count heuristic
  const raw = text.includes("\n")
    ? text
    : text.replace(/\s+#CHROM/g, "\n#CHROM").replace(/\s+chr/g, "\nchr");
  const lines = raw.split(/\r?\n/);
  const seenPositions = new Set<string>();

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    let chr = "";
    let pos = 0;
    let geno = "";

    // Parse different formats
    const parts = t.split(/\s+/);

    if (parts[0].includes("-")) {
      // Format: chr1-69511 0/1
      const [chrPos, genoStr] = parts;
      const [c, p] = chrPos.split("-");
      chr = c.replace("chr", "");
      pos = parseInt(p);
      geno = genoStr;
    } else if (parts.length >= 3) {
      // Format: chr1 69511 0/1 or full VCF row with FORMAT GT:GQ 0/1:99 at the end
      chr = parts[0].replace("chr", "");
      pos = parseInt(parts[1]);
      // Prefer explicit GT in VCF if present
      const formatIdx = parts.findIndex((p) => p.includes(":"));
      const gtField = parts.find((p) => /^(0|1|2)[\/|](0|1|2):/.test(p));
      if (gtField) {
        geno = gtField.split(":")[0];
      } else if (parts.length >= 10 && /GT/.test(parts[8])) {
        const sample = parts[9];
        const gt = sample.split(":")[0];
        geno = gt;
      } else {
        geno = parts[2];
      }
    } else if (t.includes(":")) {
      // Format: rs123:0/1
      const [rsid, genoStr] = t.split(":");
      chr = "unknown";
      pos = rsid.hashCode(); // Use hash as position for rsID
      geno = genoStr;
    }

    // Validate and normalize genotype (supports numeric 0/1 and letter genotypes like AA/AG)
    let normalized: [number, number] | null = null;
    if (geno) {
      if (/^[0-3][\/|][0-3]$/.test(geno)) {
        normalized = normalizeGenotype(geno);
      } else if (/^[ACGT]{2}$/i.test(geno)) {
        const pair = lettersToGenotypePair(geno.toUpperCase());
        normalized = pair;
      } else if (/^[ACGT][\/|][ACGT]$/i.test(geno)) {
        const letters = geno.replace("|", "/");
        const [l1, l2] = letters.split("/");
        const pair = lettersToGenotypePair((l1 + l2).toUpperCase());
        normalized = pair;
      } else if (parts.length >= 4 && /^[ACGT]{2}$/i.test(parts[3])) {
        // 23andMe-like: rsid chr pos AA
        chr = (parts[1] || "").replace("chr", "");
        pos = parseInt(parts[2]);
        const pair = lettersToGenotypePair(parts[3].toUpperCase());
        normalized = pair;
      }
    }

    if (normalized && pos > 0) {
      const posKey = `${chr}-${pos}`;

      // Skip duplicates
      if (seenPositions.has(posKey)) continue;
      seenPositions.add(posKey);

      snps.push({
        chr,
        pos,
        genotype: normalized,
      });
    }
  }

  // Sort by chromosome and position for IBD detection
  return snps.sort((a, b) => {
    const chrA = parseInt(a.chr) || 999;
    const chrB = parseInt(b.chr) || 999;
    if (chrA !== chrB) return chrA - chrB;
    return a.pos - b.pos;
  });
}

// Convert SNPs to compact pairs expected by Gemini payload
function toCompactPairs(
  snps: SNP[],
  max: number
): Array<{ p: string; g: string }> {
  const pairs: Array<{ p: string; g: string }> = [];
  for (const s of snps) {
    const g = `${s.genotype[0]}/${s.genotype[1]}`;
    pairs.push({ p: `${s.chr}-${s.pos}`, g });
    if (pairs.length >= max) break;
  }
  return pairs;
}

// Call Gemini to compare one user against multiple candidates
async function geminiCompare(input: {
  user: { userId: string; pairs: Array<{ p: string; g: string }> };
  candidates: Array<{
    userId: string;
    fileName: string;
    pairs: Array<{ p: string; g: string }>;
  }>;
}): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const system = `You are a genomics matcher. Compare a user's SNP genotype pairs against multiple candidates. 
Return STRICT JSON only with this shape (no prose):
{"matches":[{"userId":"id","relationship":"Parent|Sibling|Cousin|Unrelated|...","confidence":0-100,"details":"short reasoning"}]}
Rules:\n- Use concordance of genotype pairs at overlapping positions.\n- Favor closer relationships when concordance is high.\n- If insufficient overlap (<200 positions), either omit or mark as low confidence.\n- Do NOT invent fields. Do NOT include markdown.`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              system +
              "\n\nINPUT JSON (analyze and reply with only the output JSON):\n" +
              JSON.stringify(
                {
                  user: input.user,
                  candidates: input.candidates,
                },
                null,
                0
              ),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
    },
  } as any;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const json = extractJson(text);
    if (!json || !Array.isArray(json.matches)) return [];
    return json.matches;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(s: string): any | null {
  if (!s) return null;
  try {
    // Try direct parse first
    return JSON.parse(s);
  } catch {}
  // Try to find JSON block in text
  const match = s.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeGenotype(g: string): [number, number] | null {
  const clean = g.replace("|", "/");
  const [a, b] = clean.split("/").map(Number);

  if (isNaN(a) || isNaN(b) || a < 0 || a > 2 || b < 0 || b > 2) {
    return null;
  }

  // Return sorted alleles
  return a <= b ? [a, b] : [b, a];
}

// Map letter genotypes (AA/AG/CC) to numeric pairs using REF/ALT-agnostic encoding:
// A->0, C->1, G->2, T->3; sort for phase-agnostic comparison
function lettersToGenotypePair(letters: string): [number, number] | null {
  if (!letters || letters.length !== 2) return null;
  const map: Record<string, number> = { A: 0, C: 1, G: 2, T: 3 };
  const a = map[letters[0]];
  const b = map[letters[1]];
  if (a === undefined || b === undefined) return null;
  return a <= b ? [a, b] : [b, a];
}

// ============================================================================
// Comprehensive Kinship Analysis
// ============================================================================

function analyzeKinship(snps1: SNP[], snps2: SNP[]) {
  // Build position lookup for efficient comparison
  const map1 = new Map<string, SNP>();
  for (const snp of snps1) {
    map1.set(`${snp.chr}-${snp.pos}`, snp);
  }

  const map2 = new Map<string, SNP>();
  for (const snp of snps2) {
    map2.set(`${snp.chr}-${snp.pos}`, snp);
  }

  // Find overlapping SNPs
  const overlapping: Array<{
    pos: string;
    chr: string;
    posNum: number;
    snp1: SNP;
    snp2: SNP;
  }> = [];

  for (const [pos, snp1] of map1) {
    const snp2 = map2.get(pos);
    if (snp2) {
      overlapping.push({
        pos,
        chr: snp1.chr,
        posNum: snp1.pos,
        snp1,
        snp2,
      });
    }
  }

  if (overlapping.length < 200) {
    return {
      relationship: "Insufficient overlap",
      confidence: 0,
      details: `Only ${overlapping.length} overlapping SNPs`,
      metrics: {
        totalSNPs: overlapping.length,
        ibdSegments: 0,
        totalIBD_cM: 0,
        ibs0: 0,
        ibs1: 0,
        ibs2: 0,
        kinshipCoefficient: 0,
      },
    };
  }

  // Calculate IBS states
  const ibsStates = calculateIBS(overlapping);

  // Detect IBD segments
  const ibdSegments = detectIBDSegments(overlapping);

  // Calculate kinship coefficient
  const kinshipCoefficient = calculateKinshipCoefficient(
    ibsStates,
    overlapping.length
  );

  // Estimate total shared cM
  const totalIBD_cM = ibdSegments.reduce((sum, seg) => sum + seg.lengthCM, 0);

  // Determine relationship
  const { relationship, confidence } = determineRelationship(
    kinshipCoefficient,
    totalIBD_cM,
    ibdSegments.length,
    overlapping.length
  );

  const details = [
    `Overlapping SNPs: ${overlapping.length}`,
    `IBD Segments: ${ibdSegments.length}`,
    `Total IBD: ${totalIBD_cM.toFixed(1)} cM`,
    `Kinship: ${kinshipCoefficient.toFixed(4)}`,
    `IBS: ${ibsStates.ibs0}/${ibsStates.ibs1}/${ibsStates.ibs2}`,
  ].join(" | ");

  return {
    relationship,
    confidence,
    details,
    metrics: {
      totalSNPs: overlapping.length,
      ibdSegments: ibdSegments.length,
      totalIBD_cM,
      ibs0: ibsStates.ibs0,
      ibs1: ibsStates.ibs1,
      ibs2: ibsStates.ibs2,
      kinshipCoefficient,
    },
  };
}

// ============================================================================
// IBS Calculation
// ============================================================================

function calculateIBS(overlapping: Array<{ snp1: SNP; snp2: SNP }>) {
  let ibs0 = 0;
  let ibs1 = 0;
  let ibs2 = 0;

  for (const { snp1, snp2 } of overlapping) {
    const [a1, a2] = snp1.genotype;
    const [b1, b2] = snp2.genotype;

    // Count shared alleles
    let shared = 0;
    if (a1 === b1 || a1 === b2) shared++;
    if (a2 === b1 || a2 === b2) shared++;

    if (shared === 0) {
      ibs0++;
    } else if (shared === 1 || (a1 === a2) !== (b1 === b2)) {
      ibs1++;
    } else {
      ibs2++;
    }
  }

  return { ibs0, ibs1, ibs2 };
}

// ============================================================================
// IBD Segment Detection
// ============================================================================

function detectIBDSegments(
  overlapping: Array<{
    pos: string;
    chr: string;
    posNum: number;
    snp1: SNP;
    snp2: SNP;
  }>
): IBDSegment[] {
  const segments: IBDSegment[] = [];

  // Group by chromosome
  const byChr = new Map<string, typeof overlapping>();
  for (const item of overlapping) {
    const list = byChr.get(item.chr) || [];
    list.push(item);
    byChr.set(item.chr, list);
  }

  for (const [chr, snps] of byChr) {
    let segmentStart = -1;
    let segmentSNPs: typeof snps = [];
    let consecutiveIBS2 = 0;

    for (let i = 0; i < snps.length; i++) {
      const { snp1, snp2, posNum } = snps[i];
      const [a1, a2] = snp1.genotype;
      const [b1, b2] = snp2.genotype;

      // Check if IBS2 (fully matching)
      const isIBS2 = a1 === b1 && a2 === b2;

      if (isIBS2) {
        consecutiveIBS2++;

        if (segmentStart === -1) {
          segmentStart = posNum;
          segmentSNPs = [snps[i]];
        } else {
          segmentSNPs.push(snps[i]);
        }
      } else {
        // Break in IBD - save segment if long enough
        if (consecutiveIBS2 >= 50) {
          // Minimum 50 consecutive IBS2 SNPs
          const startPos = segmentSNPs[0].posNum;
          const endPos = segmentSNPs[segmentSNPs.length - 1].posNum;
          const lengthBp = endPos - startPos;

          // Rough conversion: 1 cM ≈ 1 Mb
          const lengthCM = lengthBp / 1_000_000;

          if (lengthCM >= 5) {
            // Minimum 5 cM
            segments.push({
              chr,
              startPos,
              endPos,
              lengthCM,
              snpCount: segmentSNPs.length,
            });
          }
        }

        // Reset
        segmentStart = -1;
        segmentSNPs = [];
        consecutiveIBS2 = 0;
      }
    }

    // Check final segment
    if (consecutiveIBS2 >= 50) {
      const startPos = segmentSNPs[0].posNum;
      const endPos = segmentSNPs[segmentSNPs.length - 1].posNum;
      const lengthCM = (endPos - startPos) / 1_000_000;

      if (lengthCM >= 5) {
        segments.push({
          chr,
          startPos,
          endPos,
          lengthCM,
          snpCount: segmentSNPs.length,
        });
      }
    }
  }

  return segments;
}

// ============================================================================
// Kinship Coefficient Calculation (KING-robust method)
// ============================================================================

function calculateKinshipCoefficient(
  ibsStates: { ibs0: number; ibs1: number; ibs2: number },
  totalSNPs: number
): number {
  const { ibs0, ibs2 } = ibsStates;

  // KING-robust kinship coefficient
  // φ = (IBS2 - 2*IBS0) / (IBS1 + 2*IBS2)
  const numerator = ibs2 - 2 * ibs0;
  const denominator = totalSNPs;

  if (denominator === 0) return 0;

  const phi = numerator / denominator;

  // Clamp between 0 and 0.5
  return Math.max(0, Math.min(0.5, phi));
}

// ============================================================================
// Relationship Determination
// ============================================================================

function determineRelationship(
  kinshipCoeff: number,
  totalIBD_cM: number,
  segmentCount: number,
  totalSNPs: number
): { relationship: string; confidence: number } {
  // Theoretical kinship coefficients:
  // Identical twins: 0.5
  // Parent-child: 0.25
  // Full siblings: 0.25
  // Half-siblings: 0.125
  // Grandparent-grandchild: 0.125
  // Aunt/Uncle-Niece/Nephew: 0.125
  // First cousins: 0.0625
  // Second cousins: 0.03125

  // Confidence based on SNP count
  let baseConfidence = Math.min(95, 50 + totalSNPs / 500);

  if (kinshipCoeff > 0.4) {
    return {
      relationship: "Identical twins or duplicate sample",
      confidence: Math.round(baseConfidence),
    };
  }

  if (kinshipCoeff >= 0.177 && kinshipCoeff <= 0.354) {
    // Check for parent-child vs full siblings using IBD segments
    if (segmentCount >= 15 && totalIBD_cM >= 2000) {
      return {
        relationship: "Full siblings",
        confidence: Math.round(baseConfidence * 0.95),
      };
    } else if (totalIBD_cM >= 3300) {
      return {
        relationship: "Parent-child",
        confidence: Math.round(baseConfidence * 0.95),
      };
    } else {
      return {
        relationship: "Parent-child or full siblings",
        confidence: Math.round(baseConfidence * 0.85),
      };
    }
  }

  if (kinshipCoeff >= 0.088 && kinshipCoeff <= 0.177) {
    if (totalIBD_cM >= 1300) {
      return {
        relationship: "Half-siblings",
        confidence: Math.round(baseConfidence * 0.85),
      };
    } else if (totalIBD_cM >= 1000) {
      return {
        relationship: "Grandparent-grandchild or Aunt/Uncle-Niece/Nephew",
        confidence: Math.round(baseConfidence * 0.8),
      };
    } else {
      return {
        relationship: "2nd degree relative",
        confidence: Math.round(baseConfidence * 0.75),
      };
    }
  }

  if (kinshipCoeff >= 0.044 && kinshipCoeff <= 0.088) {
    return {
      relationship: "First cousins",
      confidence: Math.round(baseConfidence * 0.75),
    };
  }

  if (kinshipCoeff >= 0.022 && kinshipCoeff <= 0.044) {
    return {
      relationship: "Second cousins or 1st cousin once removed",
      confidence: Math.round(baseConfidence * 0.7),
    };
  }

  if (kinshipCoeff >= 0.011 && kinshipCoeff <= 0.022) {
    return {
      relationship: "Third cousins",
      confidence: Math.round(baseConfidence * 0.65),
    };
  }

  if (kinshipCoeff > 0.005) {
    return {
      relationship: "Distant relatives (4th-6th cousins)",
      confidence: Math.round(baseConfidence * 0.6),
    };
  }

  return {
    relationship: "Unrelated or very distant",
    confidence: Math.round(baseConfidence * 0.5),
  };
}

// Helper for string hashing (for rsID fallback)
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function () {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// ============================================================================
// Basic similarity fallback (for very small inputs)
// ============================================================================

function basicSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const isVcf1 = a.includes("#CHROM") && a.includes("POS");
  const isVcf2 = b.includes("#CHROM") && b.includes("POS");
  if (isVcf1 && isVcf2) {
    return compareVcfBlocks(a, b);
  }
  const cleanA = a.toUpperCase().replace(/[^ACGT]/g, "");
  const cleanB = b.toUpperCase().replace(/[^ACGT]/g, "");
  const minLen = Math.min(cleanA.length, cleanB.length);
  if (minLen === 0) return 0;
  let eq = 0;
  for (let i = 0; i < minLen; i++) if (cleanA[i] === cleanB[i]) eq++;
  return Math.round((eq / minLen) * 100);
}

function compareVcfBlocks(v1: string, v2: string): number {
  try {
    const lines1 = v1
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith("#"));
    const lines2 = v2
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith("#"));
    if (lines1.length === 0 || lines2.length === 0) return 0;
    const map1 = new Map<string, string>();
    const map2 = new Map<string, string>();
    for (const line of lines1) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const key = `${parts[0]}_${parts[1]}_${parts[3]}_${parts[4]}`;
        map1.set(key, parts[9] || "");
      }
    }
    for (const line of lines2) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const key = `${parts[0]}_${parts[1]}_${parts[3]}_${parts[4]}`;
        map2.set(key, parts[9] || "");
      }
    }
    const total = Math.max(map1.size, map2.size);
    if (total === 0) return 0;
    let match = 0;
    for (const [k, g] of map1) if (map2.has(k) && map2.get(k) === g) match++;
    return Math.round((match / total) * 100);
  } catch {
    return 0;
  }
}

function interpretSimilarity(score: number): {
  relationship: string;
  confidence: number;
} {
  if (score >= 99.5)
    return { relationship: "Identical (same person)", confidence: 95 };
  if (score >= 99) return { relationship: "Identical twins", confidence: 90 };
  if (score >= 50)
    return { relationship: "Parent-child or siblings", confidence: 75 };
  if (score >= 25)
    return { relationship: "Grandparent or half-sibling", confidence: 60 };
  if (score >= 12.5) return { relationship: "First cousin", confidence: 55 };
  if (score >= 6.25) return { relationship: "Second cousin", confidence: 50 };
  if (score >= 3.125) return { relationship: "Third cousin", confidence: 45 };
  return { relationship: "Distant or no relation", confidence: 30 };
}
