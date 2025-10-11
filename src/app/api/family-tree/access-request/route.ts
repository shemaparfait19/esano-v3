import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/family-tree/access-request
// body: { ownerId: string, requesterId: string, access: "viewer"|"editor", message?: string }
export async function POST(request: Request) {
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
export async function PATCH(request: Request) {
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

    console.log("🔍 PATCH Access Request Debug:");
    console.log("Request ID:", id);
    console.log("Decision:", decision);
    console.log("Owner ID:", req.ownerId);
    console.log("Requester ID:", req.requesterId);
    console.log("Access type:", req.access);

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

      // Create notification for requester that their request was accepted
      console.log(
        "📧 Creating acceptance notification for requester:",
        req.requesterId
      );
      await adminDb.collection("notifications").add({
        userId: req.requesterId,
        type: "tree_access_accepted",
        title: "Family tree access granted",
        message: `Your request for ${req.access} access to a family tree has been accepted`,
        payload: {
          ownerId: req.ownerId,
          access: req.access,
          requestId: id,
        },
        status: "unread",
        createdAt: new Date().toISOString(),
      });
    } else if (decision === "deny") {
      // Create notification for requester that their request was denied
      console.log(
        "📧 Creating denial notification for requester:",
        req.requesterId
      );
      await adminDb.collection("notifications").add({
        userId: req.requesterId,
        type: "tree_access_denied",
        title: "Family tree access denied",
        message: `Your request for ${req.access} access to a family tree has been denied`,
        payload: {
          ownerId: req.ownerId,
          access: req.access,
          requestId: id,
        },
        status: "unread",
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ Error in PATCH access request:", e);
    return NextResponse.json(
      { error: "Failed to update request", detail: e?.message || "" },
      { status: 500 }
    );
  }
}

// GET /api/family-tree/access-request?ownerId=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");
    if (!ownerId) {
      return NextResponse.json(
        { error: "ownerId is required" },
        { status: 400 }
      );
    }
    const q = adminDb
      .collection("familyTreeAccessRequests")
      .where("ownerId", "==", ownerId)
      .where("status", "==", "pending");
    const snap = await q.get();
    const items = snap.docs.map((d: any) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load requests", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
