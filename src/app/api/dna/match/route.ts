import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

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

    const candidates = comparatorUsers.map((u) => ({
      userId: u.id,
      fileName: u.dnaFileName || "user_dna.txt",
      text: String(u.dnaData).slice(0, 200_000),
    }));

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

    return NextResponse.json({ matches: matches || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to match DNA" },
      { status: 500 }
    );
  }
}
