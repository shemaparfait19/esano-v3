import { NextResponse } from "next/server";
import { askGenealogyAssistant } from "@/ai/flows/ai-genealogy-assistant";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs"; // ensure Node runtime (not edge)
export const dynamic = "force-dynamic"; // avoid caching

async function withRetry<T>(fn: () => Promise<T>, tries = 2) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function POST(req: Request) {
  try {
    const { query, userId, scope, targetUserId } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set on server" },
        { status: 500 }
      );
    }

    // Determine whose data to load
    let subjectUserId: string | undefined = undefined;
    if (typeof userId === "string" && userId.length > 0) subjectUserId = userId;

    // If targetUserId provided and different, require accepted connection
    if (
      targetUserId &&
      typeof targetUserId === "string" &&
      subjectUserId &&
      targetUserId !== subjectUserId
    ) {
      const reqsSnap = await adminDb.collection("connectionRequests").get();
      const accepted = reqsSnap.docs.some((d) => {
        const r = d.data() as any;
        return (
          r.status === "accepted" &&
          ((r.fromUserId === subjectUserId && r.toUserId === targetUserId) ||
            (r.fromUserId === targetUserId && r.toUserId === subjectUserId))
        );
      });
      if (!accepted) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      subjectUserId = targetUserId;
    }

    // Gather optional user context (profile + tiny tree + connections summary)
    let userContext = undefined as string | undefined;
    if (subjectUserId) {
      try {
        const [profileSnap, treeSnap] = await Promise.all([
          adminDb.collection("users").doc(subjectUserId).get(),
          adminDb.collection("familyTrees").doc(subjectUserId).get(),
        ]);
        const profile = profileSnap.exists ? profileSnap.data() : undefined;
        const tree = treeSnap.exists ? treeSnap.data() : undefined;

        let connectionsSummary: any = undefined;
        if (scope === "connected" || scope === "global") {
          const reqsSnap2 = await adminDb
            .collection("connectionRequests")
            .get();
          const reqs2 = reqsSnap2.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter(
              (r) =>
                r.fromUserId === subjectUserId || r.toUserId === subjectUserId
            );
          const pending = reqs2.filter((r) => r.status === "pending").length;
          const accepted = reqs2.filter((r) => r.status === "accepted").length;
          connectionsSummary = { pending, accepted };
        }

        const ctx = {
          scope: scope || "own",
          subjectUserId,
          profile: profile
            ? {
                fullName: (profile as any).fullName,
                birthPlace: (profile as any).birthPlace,
                clanOrCulturalInfo: (profile as any).clanOrCulturalInfo,
                relativesNames: (profile as any).relativesNames,
              }
            : undefined,
          tree: tree
            ? {
                members: Array.isArray((tree as any).members)
                  ? (tree as any).members.slice(0, 30)
                  : [],
                edges: Array.isArray((tree as any).edges)
                  ? (tree as any).edges.slice(0, 60)
                  : [],
              }
            : undefined,
          connections: connectionsSummary,
        };
        userContext = JSON.stringify(ctx);
      } catch {}
    }

    const result = await withRetry(() =>
      askGenealogyAssistant({ query, userContext })
    );
    return NextResponse.json({ response: result.response });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Assistant unavailable", detail: e?.message ?? "" },
      { status: 500 }
    );
  }
}
