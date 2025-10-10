import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Simple test endpoint to check if family trees exist
export async function GET(request: NextRequest) {
  try {
    console.log("Testing family tree search...");

    // Check if collection exists and has data
    const qs = await adminDb.collection("familyTrees").limit(5).get();
    console.log(`Found ${qs.docs.length} family trees`);

    const trees = qs.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    return NextResponse.json({
      success: true,
      count: qs.docs.length,
      trees: trees,
    });
  } catch (e: any) {
    console.error("Test search error:", e);
    return NextResponse.json(
      { error: "Test failed", detail: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
