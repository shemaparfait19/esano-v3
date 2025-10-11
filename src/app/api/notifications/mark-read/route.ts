import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/notifications/mark-read
// body: { notificationId: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { notificationId } = body as any;

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 }
      );
    }

    // Mark notification as read
    await adminDb.collection("notifications").doc(notificationId).update({
      status: "read",
      readAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Failed to mark notification as read",
        detail: e?.message || "",
      },
      { status: 500 }
    );
  }
}
