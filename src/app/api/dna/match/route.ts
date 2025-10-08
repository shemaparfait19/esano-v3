import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { downloadDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MatchOutput = {
  userId: string;
  fileName: string;
  relationship: string;
  confidence: number; // 0..100
  details?: string;
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

    // Fetch all active DNA files metadata
    const snap = await adminDb.collection("dna_data").get();
    const all = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((d) => d.status !== "removed");

    // For demo: fetch up to N user profiles with dnaData text (legacy stored)
    const userDocs = await adminDb.collection("users").limit(100).get();
    const comparatorUsers = userDocs.docs
      .filter((d) => d.id !== userId)
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((u) => typeof u.dnaData === "string" && u.dnaData.length > 0)
      .slice(0, 50);

    const candidatesFromUsers = comparatorUsers.map((u) => ({
      userId: u.id,
      fileName: u.dnaFileName || "user_dna.txt",
      text: String(u.dnaData).slice(0, 200_000),
    }));

    // Read a limited number of dna_data files (Storage or Google Drive) as text
    const bucket = adminStorage.bucket();
    const storageCandidates: {
      userId: string;
      fileName: string;
      text: string;
    }[] = [];
    for (const meta of all.slice(0, 25)) {
      try {
        let asText = "";
        if (meta.backend === "gdrive" && meta.driveFileId) {
          const buf = await downloadDriveFile(meta.driveFileId);
          asText = buf.toString("utf8").slice(0, 200_000);
        } else if (meta.filePath) {
          const [buf] = await bucket
            .file(meta.filePath)
            .download({ validation: false });
          asText = buf.toString("utf8").slice(0, 200_000);
        } else {
          continue;
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

    // Build prompt for Gemini comparison across candidates
    const prompt = `You are an expert in genetic kinship analysis. Given one USER_DNA string and a list of OTHER_DNA entries with userId and fileName, estimate the most likely relationship for each entry (parent, child, sibling, grandparent, grandchild, aunt/uncle, niece/nephew, cousin, distant, no relation) and a confidence 0-100.
Return strict JSON array. Each item: { userId, fileName, relationship, confidence, details }.

USER_DNA:\n${String(dnaText).slice(0, 120000)}

OTHER_DNA:\n${candidates
      .map(
        (c, i) =>
          `#${i + 1} userId=${c.userId} fileName=${c.fileName}\n${c.text.slice(
            0,
            12000
          )}`
      )
      .join("\n\n")}`;

    // Call Gemini directly (keep consistent with assistant route)
    let matches: MatchOutput[] = [];
    if (process.env.GEMINI_API_KEY) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
            }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) matches = parsed as MatchOutput[];
            } catch {}
          }
        }
      } catch {}
    }

    // Fallback: deterministic IBS matching using saved text samples
    if (matches.length === 0) {
      const userMap = parseGenotypes(String(dnaText).slice(0, 200_000));
      const computed: MatchOutput[] = candidates.map((c) => {
        const otherMap = parseGenotypes(c.text);
        const { ibsSharing } = computeIbs(userMap, otherMap);
        return {
          userId: c.userId,
          fileName: c.fileName,
          relationship: estimateRelationship(ibsSharing),
          confidence: Math.round(ibsSharing),
          details: `IBS sharing ${ibsSharing.toFixed(2)}%`,
        };
      });
      // Filter low-confidence
      matches = computed.filter((m) => m.confidence >= 55).slice(0, 20);
    }

    return NextResponse.json({ matches: matches || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to match DNA" },
      { status: 500 }
    );
  }
}

// === Simple SNP parser and IBS calculator ===
function parseGenotypes(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    // Accept formats like: chr1-69511 0/1  OR  chr1 69511 0/1
    const bySpace = t.split(/\s+/);
    if (bySpace.length >= 2) {
      if (bySpace[0].includes("-")) {
        const [pos, geno] = [bySpace[0], bySpace[1]];
        if (geno && /^(0|1)[\/|](0|1)$/.test(geno))
          map[pos] = normalizeGeno(geno);
      } else if (bySpace.length >= 3) {
        const pos = `${bySpace[0]}-${bySpace[1]}`;
        const geno = bySpace[2];
        if (geno && /^(0|1)[\/|](0|1)$/.test(geno))
          map[pos] = normalizeGeno(geno);
      }
    } else if (t.includes(":")) {
      // rsID:geno fallback e.g., rs123:0/1
      const [pos, geno] = t.split(":");
      if (geno && /^(0|1)[\/|](0|1)$/.test(geno))
        map[pos] = normalizeGeno(geno);
    }
  }
  return map;
}

function normalizeGeno(g: string): string {
  const [a, b] = g.replace("|", "/").split("/");
  return [a, b].sort().join("/");
}

function computeIbs(a: Record<string, string>, b: Record<string, string>) {
  let ibs0 = 0,
    ibs1 = 0,
    ibs2 = 0,
    total = 0;
  for (const pos in a) {
    const ga = a[pos];
    const gb = b[pos];
    if (!gb) continue;
    total++;
    const [a1, a2] = ga.split("/");
    const [b1, b2] = gb.split("/");
    const shared = [a1, a2].filter((x) => x === b1 || x === b2).length;
    if (shared === 0) ibs0++;
    else if (shared === 1 || ga !== gb) ibs1++;
    else ibs2++;
  }
  const ibsSharing = total > 0 ? ((ibs1 * 0.5 + ibs2) / total) * 100 : 0;
  return { ibs0, ibs1, ibs2, total, ibsSharing };
}

function estimateRelationship(ibsSharing: number): string {
  if (ibsSharing > 99) return "Identical twins";
  if (ibsSharing >= 75) return "Parent-child or full siblings";
  if (ibsSharing >= 62.5) return "Half-siblings or grandparent-grandchild";
  if (ibsSharing >= 56.25) return "First cousins";
  if (ibsSharing >= 53) return "Second cousins";
  return "Distant or unrelated";
}
