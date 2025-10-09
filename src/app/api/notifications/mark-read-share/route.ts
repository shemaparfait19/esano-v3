import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/notifications/mark-read-share
// body: { userId: string, ownerId: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ownerId } = body as { userId?: string; ownerId?: string };
    if (!userId || !ownerId) {
      return NextResponse.json(
        { error: "userId and ownerId are required" },
        { status: 400 }
      );
    }

    const qs = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .where("type", "==", "tree_shared")
      .get();
    const batch = adminDb.batch();
    let count = 0;
    qs.docs.forEach((d) => {
      const data = d.data() as any;
      if (data?.payload?.ownerId === ownerId && data.status !== "read") {
        batch.update(d.ref, {
          status: "read",
          readAt: new Date().toISOString(),
        });
        count += 1;
      }
    });
    if (count > 0) await batch.commit();

    return NextResponse.json({ ok: true, updated: count });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to mark notifications read", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
