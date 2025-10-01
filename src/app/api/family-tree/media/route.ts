import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userId = form.get("userId") as string;
    const memberId = form.get("memberId") as string;
    const file = form.get("file") as File | null;

    if (!userId || !memberId || !file) {
      return NextResponse.json(
        { error: "userId, memberId and file are required" },
        { status: 400 }
      );
    }

    // In a real app, upload to Cloud Storage/S3 and get a URL.
    // For now, store a data URL (small files only) for demo purposes.
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const ref = adminDb.collection("familyTrees").doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Tree not found" }, { status: 404 });
    }
    const tree = snap.data() as any;
    const members = Array.isArray(tree.members) ? tree.members : [];
    const updatedMembers = members.map((m: any) => {
      if (m.id !== memberId) return m;
      const media = Array.isArray(m.mediaUrls) ? m.mediaUrls : [];
      return { ...m, mediaUrls: [...media, dataUrl] };
    });

    await ref.set({
      ...tree,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, url: dataUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Upload failed", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
