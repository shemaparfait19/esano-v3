import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { fromUserId, toUserId, text } = await req.json();
    if (!fromUserId || !toUserId || !text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // Check accepted connection in either direction
    const snap = await adminDb.collection("connectionRequests").get();
    const connected = snap.docs.some((d) => {
      const r = d.data() as any;
      return (
        r.status === "accepted" &&
        ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
          (r.fromUserId === toUserId && r.toUserId === fromUserId))
      );
    });
    if (!connected) {
      return NextResponse.json({ error: "Not connected" }, { status: 403 });
    }

    const message = {
      senderId: fromUserId,
      receiverId: toUserId,
      text: String(text).slice(0, 4000),
      createdAt: new Date().toISOString(),
      isRead: false,
      delivered: true,
    };
    await adminDb.collection("messages").add(message);

    // Notification for receiver
    try {
      await adminDb.collection("notifications").add({
        userId: toUserId,
        type: "message_received",
        relatedUserId: fromUserId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
