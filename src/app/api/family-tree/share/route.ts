import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type ShareRole = "viewer" | "editor";

// POST /api/family-tree/share
// body: { ownerId: string, email: string, role: ShareRole }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, email, role } = body as {
      ownerId?: string;
      email?: string;
      role?: ShareRole;
    };

    if (!ownerId || !email || !role) {
      return NextResponse.json(
        { error: "ownerId, email and role are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const q = await adminDb
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (q.empty) {
      return NextResponse.json(
        { error: "No user with that email" },
        { status: 404 }
      );
    }
    const targetDoc = q.docs[0];
    const targetUser = { id: targetDoc.id, ...(targetDoc.data() as any) };

    const shareDoc = {
      ownerId,
      targetUserId: targetUser.id,
      targetEmail: email,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Allow multiple shares updates: use deterministic id to upsert
    const docId = `${ownerId}_${targetUser.id}`;
    await adminDb
      .collection("familyTreeShares")
      .doc(docId)
      .set(shareDoc, { merge: true });

    // Create a notification for target
    const notification = {
      userId: targetUser.id,
      type: "tree_shared",
      title: "Family tree shared with you",
      message: `${
        shareDoc.role === "editor" ? "Edit access" : "View access"
      } from ${ownerId}.`,
      payload: { ownerId, role },
      status: "unread",
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection("notifications").add(notification);

    return NextResponse.json({ ok: true, share: shareDoc });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to share tree", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// GET /api/family-tree/share?sharedWithMe=1&userId=...  or  ?ownerId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sharedWithMe = searchParams.get("sharedWithMe");
    const userId = searchParams.get("userId");
    const ownerId = searchParams.get("ownerId");

    if (sharedWithMe && userId) {
      const qs = await adminDb
        .collection("familyTreeShares")
        .where("targetUserId", "==", userId)
        .get();
      const shares = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return NextResponse.json({ shares });
    }

    if (ownerId) {
      const qs = await adminDb
        .collection("familyTreeShares")
        .where("ownerId", "==", ownerId)
        .get();
      const shares = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return NextResponse.json({ shares });
    }

    return NextResponse.json({ shares: [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to list shares", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// PATCH /api/family-tree/share  body: { ownerId, targetUserId, role }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, targetUserId, role } = body as {
      ownerId?: string;
      targetUserId?: string;
      role?: ShareRole;
    };
    if (!ownerId || !targetUserId || !role) {
      return NextResponse.json(
        { error: "ownerId, targetUserId, role required" },
        { status: 400 }
      );
    }
    const docId = `${ownerId}_${targetUserId}`;
    await adminDb
      .collection("familyTreeShares")
      .doc(docId)
      .set({ role, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to update share", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// DELETE /api/family-tree/share?ownerId=...&targetUserId=...
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    const targetUserId = searchParams.get("targetUserId");
    if (!ownerId || !targetUserId) {
      return NextResponse.json(
        { error: "ownerId and targetUserId required" },
        { status: 400 }
      );
    }
    const docId = `${ownerId}_${targetUserId}`;
    await adminDb.collection("familyTreeShares").doc(docId).delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to remove share", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
