import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Update
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data: any = { updatedAt: new Date().toISOString() };
    [
      "title",
      "slug",
      "summary",
      "imageUrl",
      "content",
      "isPublished",
      "order",
    ].forEach((k) => {
      if (k in body) data[k] = body[k];
    });
    await adminDb.collection("counselingTopics").doc(params.id).update(data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await adminDb.collection("counselingTopics").doc(params.id).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
