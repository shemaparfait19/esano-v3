import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 Testing Firebase Admin connection...");

    // Test basic Firestore connection
    const testRef = adminDb.collection("test");
    const snapshot = await testRef.limit(1).get();

    console.log("✅ Firebase Admin connection successful");

    return NextResponse.json({
      success: true,
      message: "Firebase Admin connection working",
      docsFound: snapshot.docs.length,
    });
  } catch (error: any) {
    console.error("❌ Firebase Admin test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Firebase Admin connection failed",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
