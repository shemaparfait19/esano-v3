import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId, matches } = await req.json();
    if (!userId || !Array.isArray(matches)) {
      return NextResponse.json(
        { error: "Missing userId or matches" },
        { status: 400 }
      );
    }

    const payload = {
      analysis: {
        relatives: matches,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    } as any;

    await adminDb.collection("users").doc(userId).set(payload, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to save matches" },
      { status: 500 }
    );
  }
}
