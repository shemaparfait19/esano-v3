import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dna => list active DNA file metadata
export async function GET() {
  try {
    const snap = await adminDb.collection("dna_data").get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((d) => d.status !== "removed");
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to list DNA files" },
      { status: 500 }
    );
  }
}

// DELETE /api/dna?userId=...&fileName=...
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const fileName = searchParams.get("fileName");
    if (!userId || !fileName) {
      return NextResponse.json(
        { error: "Missing userId or fileName" },
        { status: 400 }
      );
    }

    const bucket = adminStorage.bucket();
    const filePath = `dna-files/${userId}/${fileName}`;
    try {
      await bucket.file(filePath).delete({ ignoreNotFound: true });
    } catch {}

    // Mark metadata removed
    const q = await adminDb
      .collection("dna_data")
      .where("userId", "==", userId)
      .where("fileName", "==", fileName)
      .get();
    for (const d of q.docs) {
      await d.ref.set(
        { status: "removed", removedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to delete DNA" },
      { status: 500 }
    );
  }
}
