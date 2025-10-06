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
    const kind = (form.get("kind") as string) || "media"; // media | voice | timeline
    const title = (form.get("title") as string) || undefined;
    const date = (form.get("date") as string) || new Date().toISOString();

    if (!userId || !memberId || !file) {
      return NextResponse.json(
        { error: "userId, memberId and file are required" },
        { status: 400 }
      );
    }

    // In a real app, upload to Cloud Storage/S3 and get a URL.
    // For now, store a data URL (small files only) for demo purposes.
    const arrayBuffer = await file.arrayBuffer();
    const MAX_BYTES = 2 * 1024 * 1024; // 2 MB limit for demo
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 2 MB for now. Try a shorter clip." },
        { status: 413 }
      );
    }
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const ref = adminDb.collection("familyTrees").doc(userId);
    const snap = await ref.get();
    let tree = snap.exists
      ? (snap.data() as any)
      : {
          id: userId,
          ownerId: userId,
          members: [],
          edges: [],
          settings: {
            colorScheme: "default",
            viewMode: "classic",
            layout: "horizontal",
            branchColors: {},
            nodeStyles: {},
          },
          annotations: [],
          version: { current: 1, history: [] },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    const members = Array.isArray(tree.members) ? tree.members : [];
    const idx = members.findIndex((m: any) => m.id === memberId);

    const applyToMember = (m: any) => {
      if (kind === "voice") {
        const voice = Array.isArray(m.voiceUrls) ? m.voiceUrls : [];
        return { ...m, voiceUrls: [...voice, dataUrl] };
      }
      if (kind === "timeline") {
        const timeline = Array.isArray(m.timeline) ? m.timeline : [];
        return {
          ...m,
          timeline: [
            ...timeline,
            {
              id: `tl_${Date.now()}`,
              type: file.type.startsWith("audio")
                ? "audio"
                : file.type.startsWith("video")
                ? "video"
                : "photo",
              date,
              title,
              url: dataUrl,
            },
          ],
        };
      }
      const media = Array.isArray(m.mediaUrls) ? m.mediaUrls : [];
      return { ...m, mediaUrls: [...media, dataUrl] };
    };

    if (idx >= 0) {
      // Update existing member
      tree.members = members.map((m: any, i: number) =>
        i === idx ? applyToMember(m) : m
      );
    } else {
      // Create a skeleton member so upload succeeds
      const skeleton = applyToMember({
        id: memberId,
        fullName: "",
        firstName: "",
        lastName: "",
        tags: [],
        customFields: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      tree.members = [...members, skeleton];
    }

    tree.updatedAt = new Date().toISOString();
    await ref.set(tree);
    return NextResponse.json({ success: true, url: dataUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Upload failed", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
