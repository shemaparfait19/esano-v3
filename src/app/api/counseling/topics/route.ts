import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Public: list published counseling topics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").toLowerCase();

    // Fetch published topics; avoid Firestore composite index by sorting in memory
    const snapshot = await adminDb
      .collection("counselingTopics")
      .where("isPublished", "==", true)
      .get();
    const topics = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => Number(a.order ?? 0) - Number(b.order ?? 0));

    const filtered = search
      ? topics.filter(
          (t: any) =>
            (t.title || "").toLowerCase().includes(search) ||
            (t.summary || "").toLowerCase().includes(search)
        )
      : topics;

    return NextResponse.json({ success: true, topics: filtered });
  } catch (error: any) {
    console.error("Counseling topics list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load topics", detail: error.message },
      { status: 500 }
    );
  }
}
