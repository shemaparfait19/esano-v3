import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Member = {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string; // ISO string
  deathDate?: string; // ISO string
  gender?: string;
};

type Edge = {
  id?: string;
  fromId: string;
  toId: string;
  type: string;
};

function parseYear(date?: string): number | undefined {
  if (!date) return undefined;
  const d = Date.parse(date);
  if (Number.isNaN(d)) return undefined;
  return new Date(d).getFullYear();
}

function checkConflicts(members: Member[], edges: Edge[]) {
  const conflicts: { type: string; message: string; relatedIds: string[] }[] =
    [];
  const byId = new Map(members.map((m) => [m.id, m] as const));

  // Rules: child younger than parent; impossible age gaps; duplicate names with similar birth years
  edges.forEach((e) => {
    if (e.type !== "parent") return;
    const parent = byId.get(e.fromId);
    const child = byId.get(e.toId);
    if (!parent || !child) return;
    const py = parseYear(parent.birthDate);
    const cy = parseYear(child.birthDate);
    if (py !== undefined && cy !== undefined) {
      if (py >= cy) {
        conflicts.push({
          type: "date_conflict",
          message: `${parent.fullName || parent.id} cannot be parent of ${
            child.fullName || child.id
          } if born in ${py} and child in ${cy}.`,
          relatedIds: [parent.id, child.id],
        });
      }
      if (cy - py > 70) {
        conflicts.push({
          type: "age_gap",
          message: `Unlikely age gap between parent (${py}) and child (${cy}).`,
          relatedIds: [parent.id, child.id],
        });
      }
    }
  });

  // Duplicate detection
  const byKey = new Map<string, Member[]>();
  members.forEach((m) => {
    const y = parseYear(m.birthDate);
    const key = `${(m.fullName || `${m.firstName || ""} ${m.lastName || ""}`)
      .trim()
      .toLowerCase()}|${y ?? "?"}`;
    const arr = byKey.get(key) || [];
    arr.push(m);
    byKey.set(key, arr);
  });
  byKey.forEach((arr) => {
    if (arr.length > 1) {
      conflicts.push({
        type: "duplicate_member",
        message: `Possible duplicate records: ${arr
          .map((m) => m.fullName || m.id)
          .join(", ")}.`,
        relatedIds: arr.map((m) => m.id),
      });
    }
  });

  return conflicts;
}

function smartSuggestions(members: Member[], edges: Edge[]) {
  const suggestions: {
    confidence: number;
    action: "link" | "create_parent" | "create_child";
    detail: string;
    payload: any;
  }[] = [];

  const byId = new Map(members.map((m) => [m.id, m] as const));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (e.type === "parent") {
      childrenOf.set(e.fromId, [...(childrenOf.get(e.fromId) || []), e.toId]);
      parentsOf.set(e.toId, [...(parentsOf.get(e.toId) || []), e.fromId]);
    }
  });

  // Suggest missing second parent when only one exists
  members.forEach((m) => {
    const ps = parentsOf.get(m.id) || [];
    if (ps.length === 1) {
      const parent = byId.get(ps[0]);
      if (!parent) return;
      suggestions.push({
        confidence: 0.72,
        action: "create_parent",
        detail: `Add second parent for ${m.fullName || m.id}?`,
        payload: { childId: m.id },
      });
      suggestions.push({
        confidence: 0.6,
        action: "link",
        detail: `Is there a spouse for ${
          parent.fullName || parent.id
        }? Link as co-parent.`,
        payload: { fromId: parent.id, relation: "spouse" },
      });
    }
  });

  // Suggest probable relationships between close-in-age, same surname
  const surname = (m: Member) =>
    (
      m.lastName ||
      (m.fullName || "").split(" ").slice(-1)[0] ||
      ""
    ).toLowerCase();
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const ay = parseYear(a.birthDate);
      const by = parseYear(b.birthDate);
      const sScore = surname(a) && surname(a) === surname(b) ? 0.1 : 0;
      if (ay !== undefined && by !== undefined) {
        const diff = Math.abs(ay - by);
        if (diff <= 3) {
          suggestions.push({
            confidence: 0.55 + sScore,
            action: "link",
            detail: `Are ${a.fullName || a.id} and ${
              b.fullName || b.id
            } siblings?`,
            payload: { fromId: a.id, toId: b.id, relation: "sibling" },
          });
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body || {};
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const snap = await adminDb.collection("familyTrees").doc(userId).get();
    if (!snap.exists) {
      return NextResponse.json({ suggestions: [], conflicts: [] });
    }
    const tree = snap.data() as { members?: Member[]; edges?: Edge[] };
    const members = Array.isArray(tree.members) ? tree.members : [];
    const edges = Array.isArray(tree.edges) ? tree.edges : [];

    const conflicts = checkConflicts(members, edges);
    const suggestions = smartSuggestions(members, edges);

    return NextResponse.json({ suggestions, conflicts });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to generate suggestions", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
