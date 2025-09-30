import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (!a || !b)
      return NextResponse.json({ error: "Missing users" }, { status: 400 });

    // Only return messages between a and b
    const snap = await adminDb.collection("messages").get();
    const msgs = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter(
        (m) =>
          (m.senderId === a && m.receiverId === b) ||
          (m.senderId === b && m.receiverId === a)
      )
      .sort((x, y) => (x.createdAt || "").localeCompare(y.createdAt || ""));
    return NextResponse.json({ messages: msgs.slice(0, 500) });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
