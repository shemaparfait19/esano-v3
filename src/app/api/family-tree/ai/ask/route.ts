import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/family-tree/ai/ask
// body: { ownerId: string, question: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, question } = body as {
      ownerId?: string;
      question?: string;
    };

    if (!ownerId || !question) {
      return NextResponse.json(
        { error: "ownerId and question are required" },
        { status: 400 }
      );
    }

    const snap = await adminDb.collection("familyTrees").doc(ownerId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Family tree not found" },
        { status: 404 }
      );
    }
    const tree = snap.data() as any;

    // Build a compact textual context for quick LLM calls (placeholder logic)
    const summaryMembers = (tree.members || []).slice(0, 200).map((m: any) => ({
      id: m.id,
      name: m.fullName || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
      birthYear: m.birthYear,
      deathYear: m.deathYear,
      notes: m.bio || m.notes || "",
    }));
    const summaryEdges = (tree.edges || []).slice(0, 500).map((e: any) => ({
      fromId: e.fromId,
      toId: e.toId,
      type: e.type,
    }));

    // For now, synthesize a lightweight answer without external LLMs
    // Clients can replace this with a Gemini call server-side.
    const lowerQ = question.toLowerCase();
    let answer = "";
    if (lowerQ.includes("head") || lowerQ.includes("root")) {
      const head = summaryMembers.find(
        (m: any) =>
          m.name &&
          tree.members?.find((x: any) => x.id === m.id)?.isHeadOfFamily
      );
      answer = head
        ? `${head.name} is marked as head of family.`
        : "No head of family is marked.";
    } else if (lowerQ.includes("how many") && lowerQ.includes("members")) {
      answer = `There are ${summaryMembers.length} members in this tree.`;
    } else {
      // Simple name lookup
      const nameHit = summaryMembers.find(
        (m: any) => m.name && lowerQ.includes((m.name as string).toLowerCase())
      );
      if (nameHit) {
        answer = `${nameHit.name}: ${nameHit.birthYear || "?"} - ${
          nameHit.deathYear || "Present"
        }.`;
      } else {
        answer =
          "I analyzed the tree summary but couldn't find a direct answer to that question.";
      }
    }

    return NextResponse.json({
      ok: true,
      answer,
      context: { members: summaryMembers.length, edges: summaryEdges.length },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "AI query failed", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
