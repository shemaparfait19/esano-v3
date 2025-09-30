import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const snap = await adminDb.collection("messages").get();
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Build last message per peer for this user
    const peers = new Map<string, any>();
    for (const m of all) {
      if (m.senderId !== userId && m.receiverId !== userId) continue;
      const peer = m.senderId === userId ? m.receiverId : m.senderId;
      const key = peer;
      const prev = peers.get(key);
      if (!prev || (prev.createdAt || "") < (m.createdAt || "")) {
        peers.set(key, m);
      }
    }

    const list = Array.from(peers.entries()).map(([peerId, m]) => ({
      peerId,
      lastMessage: m.text,
      createdAt: m.createdAt,
    }));
    list.sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
    return NextResponse.json({ chats: list.slice(0, 100) });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
