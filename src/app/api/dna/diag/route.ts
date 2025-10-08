import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dnaSnap = await adminDb.collection("dna_data").get();
    const dnaDocs = dnaSnap.docs.map((d: any) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    const active = dnaDocs.filter((d: any) => d.status !== "removed");

    const usersSnap = await adminDb.collection("users").limit(200).get();
    const userDocs = usersSnap.docs
      .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
      .filter(
        (u: any) => typeof u.dnaData === "string" && u.dnaData.length > 0
      );

    const candidateSummaries = [
      ...active.slice(0, 20).map((d: any) => ({
        source: "dna_data",
        userId: d.userId,
        fileName: d.fileName,
        textSampleLen:
          typeof d.textSample === "string" ? d.textSample.length : 0,
      })),
      ...userDocs.slice(0, 20).map((u: any) => ({
        source: "users",
        userId: u.id,
        fileName: u.dnaFileName || "user_dna.txt",
        textSampleLen: (u.dnaData || "").length,
      })),
    ];

    return NextResponse.json({
      ok: true,
      dnaDataCount: active.length,
      usersWithDnaCount: userDocs.length,
      candidateSummaries,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "diag failed" },
      { status: 500 }
    );
  }
}
