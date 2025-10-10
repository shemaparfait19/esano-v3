import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/family-tree/access-request
// body: { ownerId: string, requesterId: string, access: "viewer"|"editor", message?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, requesterId, access, message } = body as any;
    if (!ownerId || !requesterId || !access) {
      return NextResponse.json(
        { error: "ownerId, requesterId and access are required" },
        { status: 400 }
      );
    }
    const doc = {
      ownerId,
      requesterId,
      access,
      message: message || "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection("familyTreeAccessRequests").add(doc);
    // notify owner
    await adminDb.collection("notifications").add({
      userId: ownerId,
      type: "tree_access_request",
      title: "New tree access request",
      message: `A user requested ${access} access to your family tree`,
      payload: { requestId: ref.id, requesterId, access },
      status: "unread",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to request access", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// PATCH /api/family-tree/access-request  body: { id, decision: "accept"|"deny" }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, decision } = body as any;
    if (!id || !decision) {
      return NextResponse.json(
        { error: "id and decision are required" },
        { status: 400 }
      );
    }
    const ref = adminDb.collection("familyTreeAccessRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const req = snap.data() as any;

    await ref.set(
      { status: decision, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    if (decision === "accept") {
      // create share
      const docId = `${req.ownerId}_${req.requesterId}`;
      await adminDb.collection("familyTreeShares").doc(docId).set(
        {
          ownerId: req.ownerId,
          targetUserId: req.requesterId,
          role: req.access,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // notify requester
    await adminDb.collection("notifications").add({
      userId: req.requesterId,
      type: "tree_access_response",
      title: decision === "accept" ? "Access granted" : "Access denied",
      message:
        decision === "accept"
          ? `You now have ${req.access} access to the tree`
          : `Your request was denied`,
      payload: { ownerId: req.ownerId, decision },
      status: "unread",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to update request", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// GET /api/family-tree/access-request?ownerId=.. or ?requesterId=..
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    const requesterId = searchParams.get("requesterId");

    if (!ownerId && !requesterId) {
      return NextResponse.json({ items: [] });
    }

    let q = adminDb.collection("familyTreeAccessRequests") as any;
    if (ownerId) q = q.where("ownerId", "==", ownerId);
    if (requesterId) q = q.where("requesterId", "==", requesterId);

    const qs = await q.limit(50).get();

    // If no requests exist, return empty array
    if (qs.empty) {
      return NextResponse.json({ items: [] });
    }

    const items = qs.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ items });
  } catch (e: any) {
    console.error("Access request list error:", e);
    return NextResponse.json(
      { error: "Failed to list requests", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
