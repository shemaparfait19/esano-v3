import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { askGenealogyAssistant } from "@/ai/flows/ai-genealogy-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, memberId } = body as { userId?: string; memberId?: string };
    if (!userId || !memberId) {
      return NextResponse.json(
        { error: "userId and memberId are required" },
        { status: 400 }
      );
    }

    const treeSnap = await adminDb.collection("familyTrees").doc(userId).get();
    if (!treeSnap.exists) {
      return NextResponse.json({ error: "Tree not found" }, { status: 404 });
    }
    const tree = treeSnap.data() as any;
    const member = (tree.members || []).find((m: any) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Gather brief kinship context (parents, spouses, children)
    const edges: any[] = tree.edges || [];
    const parents = edges
      .filter((e) => e.type === "parent" && e.toId === memberId)
      .map(
        (e) =>
          (tree.members || []).find((m: any) => m.id === e.fromId)?.fullName
      )
      .filter(Boolean);
    const children = edges
      .filter((e) => e.type === "parent" && e.fromId === memberId)
      .map(
        (e) => (tree.members || []).find((m: any) => m.id === e.toId)?.fullName
      )
      .filter(Boolean);
    const spouses = edges
      .filter(
        (e) =>
          e.type === "spouse" && (e.fromId === memberId || e.toId === memberId)
      )
      .map(
        (e) =>
          (tree.members || []).find(
            (m: any) => m.id === (e.fromId === memberId ? e.toId : e.fromId)
          )?.fullName
      )
      .filter(Boolean);

    const concise = {
      name: member.fullName,
      gender: member.gender,
      birthDate: member.birthDate,
      deathDate: member.deathDate,
      location: member.location,
      ethnicity: member.ethnicity,
      originRegion: member.originRegion,
      tags: member.tags,
      parents,
      spouses,
      children,
    };

    const prompt = `Write a warm, concise 2-3 paragraph family story about this person, suitable for a family tree page. Emphasize origin, values, and key life moments. Avoid fabrications; use only provided data.
DATA:\n${JSON.stringify(concise)}`;

    const response = await askGenealogyAssistant({
      query: prompt,
      userId,
      scope: "member_story",
    });

    const story =
      typeof response === "string" ? response : response?.text ?? "";
    if (!story) {
      return NextResponse.json(
        { error: "Failed to generate story" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, story });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Story generation failed", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
