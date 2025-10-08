import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { downloadDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchOutput = {
  userId: string;
  fileName: string;
  relationship: string;
  confidence: number;
  details: string;
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

    if (userSNPs.length < 1000) {
      return NextResponse.json(
        {
          error:
            "Insufficient SNP data. Need at least 1000 valid SNPs for analysis.",
        },
        { status: 400 }
      );
    }

    // Fetch all active DNA files metadata
    const snap = await adminDb.collection("dna_data").get();
    const all = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((d) => d.status !== "removed");

    // Fetch user profiles with DNA data
    const userDocs = await adminDb.collection("users").limit(100).get();
    const comparatorUsers = userDocs.docs
      .filter((d) => d.id !== userId)
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((u) => typeof u.dnaData === "string" && u.dnaData.length > 0)
      .slice(0, 50);

    const candidatesFromUsers = comparatorUsers.map((u) => ({
      userId: u.id,
      fileName: u.dnaFileName || "user_dna.txt",
      text: String(u.dnaData),
    }));

    // Read DNA data files
    const bucket = adminStorage.bucket();
    const storageCandidates: {
      userId: string;
      fileName: string;
      text: string;
    }[] = [];

    for (const meta of all.slice(0, 50)) {
      try {
        if (meta.userId === userId) continue;
        let asText = "";

        if (meta.textSample && meta.textSample.length > 0) {
          asText = String(meta.textSample);
        } else if (meta.backend === "gdrive" && meta.driveFileId) {
          const buf = await downloadDriveFile(meta.driveFileId);
          asText = buf.toString("utf8");
        } else if (meta.filePath) {
          const [buf] = await bucket
            .file(meta.filePath)
            .download({ validation: false });
          asText = buf.toString("utf8");
        }

        if (asText.length > 0) {
          storageCandidates.push({
            userId: meta.userId,
            fileName: meta.fileName,
            text: asText,
          });
        }
      } catch {}
    }

    const candidates = [...candidatesFromUsers, ...storageCandidates];

    if (candidates.length === 0) {
      return NextResponse.json({ matches: [] satisfies MatchOutput[] });
    }

    // Analyze each candidate
    const matches: MatchOutput[] = [];

    for (const candidate of candidates) {
      try {
        const candidateSNPs = parseAndFilterSNPs(candidate.text);

        if (candidateSNPs.length < 1000) continue;

        // Perform comprehensive kinship analysis
        const analysis = analyzeKinship(userSNPs, candidateSNPs);

        // Only include matches with sufficient data quality
        if (analysis.metrics.totalSNPs >= 1000) {
          matches.push({
            userId: candidate.userId,
            fileName: candidate.fileName,
            relationship: analysis.relationship,
            confidence: analysis.confidence,
            details: analysis.details,
            metrics: analysis.metrics,
          });
        }
      } catch (err) {
        console.error(`Error analyzing candidate ${candidate.userId}:`, err);
      }
    }

    // Sort by kinship coefficient (most related first)
    matches.sort(
      (a, b) => b.metrics.kinshipCoefficient - a.metrics.kinshipCoefficient
    );

    // Return top 50 matches
    return NextResponse.json({ matches: matches.slice(0, 50) });
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
  const lines = text.split(/\r?\n/);
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
      // Format: chr1 69511 0/1 or 1 69511 0/1
      chr = parts[0].replace("chr", "");
      pos = parseInt(parts[1]);
      geno = parts[2];
    } else if (t.includes(":")) {
      // Format: rs123:0/1
      const [rsid, genoStr] = t.split(":");
      chr = "unknown";
      pos = rsid.hashCode(); // Use hash as position for rsID
      geno = genoStr;
    }

    // Validate and normalize genotype
    if (geno && /^[0-2][\/|][0-2]$/.test(geno)) {
      const normalized = normalizeGenotype(geno);
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
  }

  // Sort by chromosome and position for IBD detection
  return snps.sort((a, b) => {
    const chrA = parseInt(a.chr) || 999;
    const chrB = parseInt(b.chr) || 999;
    if (chrA !== chrB) return chrA - chrB;
    return a.pos - b.pos;
  });
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

  if (overlapping.length < 1000) {
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
