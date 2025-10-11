import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/logs/export
export async function GET() {
  try {
    const logsSnapshot = await adminDb
      .collection("activityLogs")
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get();

    const logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Convert to CSV format
    const csvHeaders = "Timestamp,User,Action,Details,IP Address\n";
    const csvRows = logs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        const userName = log.userName || "Unknown";
        const action = log.action || "";
        const details = (log.details || "").replace(/"/g, '""'); // Escape quotes
        const ipAddress = log.ipAddress || "";

        return `"${timestamp}","${userName}","${action}","${details}","${ipAddress}"`;
      })
      .join("\n");

    const csvContent = csvHeaders + csvRows;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="esano-logs-${
          new Date().toISOString().split("T")[0]
        }.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting logs:", error);
    return NextResponse.json(
      { error: "Failed to export logs", detail: error.message },
      { status: 500 }
    );
  }
}
