import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Admin list
export async function GET(request: NextRequest) {
  try {
    const snapshot = await adminDb
      .collection("counselingTopics")
      .orderBy("order", "asc")
      .get();
    const topics = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, topics });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Create
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const data = {
      title: body.title || "",
      slug: body.slug || "",
      summary: body.summary || "",
      imageUrl: body.imageUrl || "",
      content: body.content || "",
      isPublished: Boolean(body.isPublished),
      order: Number(body.order ?? 0),
      createdAt: now,
      updatedAt: now,
    };
    const doc = await adminDb.collection("counselingTopics").add(data);
    return NextResponse.json({ success: true, id: doc.id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
