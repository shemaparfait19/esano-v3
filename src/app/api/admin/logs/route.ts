import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/logs
export async function GET() {
  try {
    const logsSnapshot = await adminDb
      .collection("activityLogs")
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs", detail: error.message },
      { status: 500 }
    );
  }
}
