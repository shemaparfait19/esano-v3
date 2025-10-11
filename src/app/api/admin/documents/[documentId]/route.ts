import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/documents/[documentId] - View uploaded document
export async function GET(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    // In a real implementation, you would:
    // 1. Verify admin authentication
    // 2. Get the document from Firebase Storage
    // 3. Return the file content with proper headers

    // For now, return a placeholder response
    return NextResponse.json({
      message: "Document viewing functionality",
      documentId,
      note: "In production, this would return the actual document file",
    });
  } catch (error: any) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document", detail: error.message },
      { status: 500 }
    );
  }
}
