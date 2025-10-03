import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string) || "";
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mime = file.type || "image/png";
    const dataUrl = `data:${mime};base64,${base64}`;

    // Optionally persist into user profile if userId provided
    if (userId) {
      try {
        await adminDb
          .collection("users")
          .doc(userId)
          .set(
            { profilePicture: dataUrl, updatedAt: new Date().toISOString() },
            { merge: true }
          );
      } catch {}
    }

    return NextResponse.json({ ok: true, url: dataUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
