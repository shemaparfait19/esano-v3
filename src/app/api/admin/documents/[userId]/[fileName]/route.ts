import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

// GET /api/admin/documents/[userId]/[fileName] - View uploaded document
export async function GET(
  request: Request,
  { params }: { params: { userId: string; fileName: string } }
) {
  try {
    const { userId, fileName } = params;

    // Construct file path
    const filePath = join(
      process.cwd(),
      "uploads",
      "documents",
      userId,
      fileName
    );

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Determine content type based on file extension
    const extension = fileName.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";

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

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
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
