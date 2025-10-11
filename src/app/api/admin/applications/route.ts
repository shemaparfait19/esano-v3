import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/applications - Get all applications
export async function GET() {
  try {
    const applicationsSnapshot = await adminDb
      .collection("familyTreeApplications")
      .orderBy("createdAt", "desc")
      .get();

    const applications = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error("Get applications error:", error);
    return NextResponse.json(
      { error: "Failed to get applications", detail: error.message },
      { status: 500 }
    );
  }
}
