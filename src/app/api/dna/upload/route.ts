import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { uploadToDrive } from "@/lib/google-drive";
import { adminDb as db } from "@/lib/firebase-admin";
import { driveClientWithTokens } from "@/lib/google-oauth";

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

    // Prefer per-user OAuth tokens if available; else service account; else GCS
    let userTokens: any | undefined;
    try {
      const tSnap = await db.collection("oauthTokens").doc(userId).get();
      userTokens = tSnap.exists ? (tSnap.data() as any).googleDrive : undefined;
    } catch {}
    const preferUserDrive = Boolean(userTokens);
    const preferServiceDrive = Boolean(
      process.env.GDRIVE_SERVICE_ACCOUNT_JSON && process.env.GDRIVE_FOLDER_ID
    );

    if (preferUserDrive) {
      const fileName = file.name || `dna_${Date.now()}.txt`;
      const drive = driveClientWithTokens(userTokens);
      const res: any = await drive.files.create({
        requestBody: { name: fileName, mimeType: file.type || "text/plain" },
        media: {
          mimeType: file.type || "text/plain",
          body: BufferToStream(buf) as any,
        },
        fields: "id, name, webViewLink",
      });
      const textSample = buf.toString("utf8").slice(0, 1_000_000);
      const doc = {
        userId,
        fileName: res.data.name as string,
        fileUrl: (res.data.webViewLink as string) || "",
        driveFileId: res.data.id as string,
        uploadDate: new Date().toISOString(),
        fileSize: buf.byteLength,
        status: "active" as const,
        backend: "gdrive_user" as const,
        textSample,
      };
      const savedRef = await adminDb.collection("dna_data").add(doc);
      // Also persist normalized text to the user's profile for fast matching
      try {
        await adminDb
          .collection("users")
          .doc(userId)
          .set(
            {
              userId,
              dnaData: textSample,
              dnaFileName: res.data.name as string,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      } catch {}
      return NextResponse.json({ ok: true, id: savedRef.id, ...doc });
    } else if (preferServiceDrive) {
      const fileName = file.name || `dna_${Date.now()}.txt`;
      const driveRes = await uploadToDrive({
        folderId: process.env.GDRIVE_FOLDER_ID as string,
        name: fileName,
        mimeType: file.type || "text/plain",
        data: buf,
      });
      const textSample = buf.toString("utf8").slice(0, 1_000_000);
      const doc = {
        userId,
        fileName: driveRes.name,
        fileUrl: driveRes.webViewLink || "",
        driveFileId: driveRes.fileId,
        uploadDate: new Date().toISOString(),
        fileSize: buf.byteLength,
        status: "active" as const,
        backend: "gdrive_service" as const,
        textSample,
      };
      const savedRef = await adminDb.collection("dna_data").add(doc);
      try {
        await adminDb.collection("users").doc(userId).set(
          {
            userId,
            dnaData: textSample,
            dnaFileName: driveRes.name,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
      return NextResponse.json({ ok: true, id: savedRef.id, ...doc });
    } else {
      // No Google Drive (user/service) configured; avoid falling back to GCS to prevent bucket errors
      return NextResponse.json(
        {
          error:
            "No Google Drive connection found. Click 'Connect Google Drive' on your profile first.",
          reason: "no_drive_connection",
        },
        { status: 400 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to upload DNA" },
      { status: 500 }
    );
  }
}

function BufferToStream(buffer: Buffer) {
  const { Readable } = require("stream");
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}
