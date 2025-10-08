import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { uploadToDrive } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST multipart/form-data: userId, file
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const userId = String(form.get("userId") || "").trim();
    const file = form.get("file") as File | null;
    if (!userId || !file) {
      return NextResponse.json(
        { error: "Missing userId or file" },
        { status: 400 }
      );
    }
    // Basic size/type checks
    const allowed =
      /^(text\/|application\/octet-stream)/.test(file.type) ||
      /\.(txt|csv|tsv|zip|gz)$/i.test(file.name);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (!allowed) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload raw text-like DNA exports." },
        { status: 415 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > maxSize) {
      return NextResponse.json(
        { error: "File too large. Max 10 MB." },
        { status: 413 }
      );
    }

    const preferDrive = Boolean(
      process.env.GDRIVE_SERVICE_ACCOUNT_JSON && process.env.GDRIVE_FOLDER_ID
    );

    if (preferDrive) {
      const fileName = file.name || `dna_${Date.now()}.txt`;
      const driveRes = await uploadToDrive({
        folderId: process.env.GDRIVE_FOLDER_ID as string,
        name: fileName,
        mimeType: file.type || "text/plain",
        data: buf,
      });
      const doc = {
        userId,
        fileName: driveRes.name,
        fileUrl: driveRes.webViewLink || "",
        driveFileId: driveRes.fileId,
        uploadDate: new Date().toISOString(),
        fileSize: buf.byteLength,
        status: "active" as const,
        backend: "gdrive" as const,
      };
      await adminDb.collection("dna_data").add(doc);
      return NextResponse.json({ ok: true, ...doc });
    } else {
      const bucket = adminStorage.bucket();
      const fileName = file.name || `dna_${Date.now()}.txt`;
      const dest = `dna-files/${userId}/${fileName}`;
      const gcsFile = bucket.file(dest);
      await gcsFile.save(buf, {
        contentType: file.type || "text/plain",
        resumable: false,
        metadata: { cacheControl: "private, max-age=0" },
      });
      const [signedUrl] = await gcsFile.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 2,
      });
      const doc = {
        userId,
        fileName,
        fileUrl: signedUrl,
        filePath: dest,
        uploadDate: new Date().toISOString(),
        fileSize: buf.byteLength,
        status: "active" as const,
        backend: "gcs" as const,
      };
      await adminDb.collection("dna_data").add(doc);
      return NextResponse.json({ ok: true, ...doc });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to upload DNA" },
      { status: 500 }
    );
  }
}
