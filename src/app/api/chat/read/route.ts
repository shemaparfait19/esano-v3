import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { receiverId, senderId } = await req.json();
    if (!receiverId || !senderId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const snap = await adminDb.collection("messages").get();
    const batch = adminDb.batch?.() as any;
    let count = 0;
    for (const d of snap.docs) {
      const m = d.data() as any;
      if (
        m.receiverId === receiverId &&
        m.senderId === senderId &&
        m.isRead === false
      ) {
        if (batch && adminDb.doc) {
          // If Firestore v11+, adminDb.batch exists
          batch.update(d.ref, { isRead: true });
        } else {
          await d.ref.set({ isRead: true }, { merge: true });
        }
        count++;
      }
    }
    if (batch && count > 0) await batch.commit();
    return NextResponse.json({ ok: true, updated: count });
  } catch (e) {
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
