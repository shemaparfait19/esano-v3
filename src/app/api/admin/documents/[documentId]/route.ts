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
    console.log("Fetching document with ID:", documentId);

    // Get document from Firestore
    const docSnapshot = await adminDb
      .collection("uploadedDocuments")
      .doc(documentId)
      .get();

    console.log("Document exists:", docSnapshot.exists);

    if (!docSnapshot.exists) {
      console.log("Document not found in Firestore");
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const docData = docSnapshot.data();
    if (!docData) {
      return NextResponse.json(
        { error: "Document data not found" },
        { status: 404 }
      );
    }

    // Convert base64 content back to buffer
    const binaryString = atob(docData.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fileBuffer = bytes.buffer;

    // Determine content type
    let contentType = "application/octet-stream";
    if (docData.fileType) {
      contentType = docData.fileType;
    } else {
      // Fallback based on file extension
      const extension = docData.fileName?.split(".").pop()?.toLowerCase();
      switch (extension) {
        case "pdf":
          contentType = "application/pdf";
          break;
        case "jpg":
        case "jpeg":
          contentType = "image/jpeg";
          break;
        case "png":
          contentType = "image/png";
          break;
        case "gif":
          contentType = "image/gif";
          break;
      }
    }

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${docData.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document", detail: error.message },
      { status: 500 }
    );
  }
}
