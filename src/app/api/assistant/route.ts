import { NextResponse } from "next/server";
import { askGenealogyAssistant } from "@/ai/flows/ai-genealogy-assistant";
import { adminDb } from "@/lib/firebase-admin";

async function buildKinshipFacts(userId: string) {
  try {
    const treeSnap = await adminDb.collection("familyTrees").doc(userId).get();
    if (!treeSnap.exists) return [];
    const tree = treeSnap.data() as any;
    const members: Record<string, any> = Object.fromEntries(
      (tree.members || []).map((m: any) => [m.id, m])
    );
    const edges: any[] = tree.edges || [];

    const parentsOf = new Map<string, string[]>();
    edges.forEach((e: any) => {
      if (e.type === "parent") {
        parentsOf.set(e.toId, [...(parentsOf.get(e.toId) || []), e.fromId]);
      }
    });

    const facts: string[] = [];
    (parentsOf.get(userId) || []).forEach((pid) => {
      const p = members[pid];
      if (p?.fullName) facts.push(`${p.fullName} is my parent.`);
    });
    (parentsOf.get(userId) || []).forEach((pid) => {
      (parentsOf.get(pid) || []).forEach((gpid) => {
        const gp = members[gpid];
        if (gp?.fullName) facts.push(`${gp.fullName} is my grandparent.`);
      });
    });
    return facts.slice(0, 20); // Reduced from 50
  } catch {
    return [];
  }
}

// Optimized: Get only recent messages with indexed queries
async function getRecentMessages(userId: string) {
  try {
    // Use indexed queries instead of scanning all messages
    const [sentDocs, receivedDocs] = await Promise.all([
      adminDb
        .collection("messages")
        .where("senderId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(5) // Only get 5 most recent
        .get(),
      adminDb
        .collection("messages")
        .where("receiverId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
    ]);

    return [...sentDocs.docs, ...receivedDocs.docs]
      .map((d) => {
        const data = d.data() as any;
        return {
          peerId: data.senderId === userId ? data.receiverId : data.senderId,
          direction: data.senderId === userId ? "out" : "in",
          text: typeof data.text === "string" ? data.text.slice(0, 150) : "",
          createdAt: data.createdAt,
        };
      })
      .slice(0, 10);
  } catch (e) {
    console.error("Failed to fetch messages:", e);
    return [];
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { query, userId, scope, targetUserId } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    // Diagnostics endpoint
    if (query === "__diag") {
      const hasGemini = Boolean(process.env.GEMINI_API_KEY);
      const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
      const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
      return NextResponse.json({
        ok: true,
        hasGemini,
        hasDeepseek,
        hasOpenRouter,
      });
    }

    let subjectUserId: string | undefined = userId;

    // Connection check for targetUserId
    if (targetUserId && targetUserId !== subjectUserId && subjectUserId) {
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

    // Gather user context with PARALLEL queries and REDUCED data
    let userContext: string | undefined;
    if (subjectUserId) {
      try {
        // Run ALL database queries in parallel
        const [profileSnap, treeSnap, kinship, messages] = await Promise.all([
          adminDb.collection("users").doc(subjectUserId).get(),
          adminDb.collection("familyTrees").doc(subjectUserId).get(),
          buildKinshipFacts(subjectUserId),
          getRecentMessages(subjectUserId),
        ]);

        const profile = profileSnap.exists ? profileSnap.data() : undefined;
        const tree = treeSnap.exists ? treeSnap.data() : undefined;

        // Build minimal context - only essential fields
        const ctx = {
          profile: profile
            ? {
                firstName: profile.firstName,
                lastName: profile.lastName,
                birthDate: profile.birthDate,
                birthPlace: profile.birthPlace,
              }
            : undefined,
          tree: tree
            ? {
                members: Array.isArray(tree.members)
                  ? tree.members.slice(0, 15)
                  : [],
                edges: Array.isArray(tree.edges) ? tree.edges.slice(0, 30) : [],
              }
            : undefined,
          kinship: kinship.slice(0, 10),
          messages: messages.slice(0, 5),
        };
        userContext = JSON.stringify(ctx);
      } catch (e) {
        console.error("Context gathering failed:", e);
        // Continue without context rather than failing
      }
    }

    // Try OpenRouter first (with reduced timeout)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000); // 7s timeout

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer":
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost",
              "X-Title": "eSANO",
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL || "openrouter/auto",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful genealogy AI assistant. Be concise.",
                },
                {
                  role: "user",
                  content: userContext
                    ? `Context: ${userContext}\n\nQ: ${query}`
                    : query,
                },
              ],
              max_tokens: 250, // Reduced for faster response
              temperature: 0.3,
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content || "";
          if (content) {
            return NextResponse.json({ response: content });
          }
        }
      } catch (e: any) {
        console.error("OpenRouter failed:", e.message);
        // Fall through to next provider
      }
    }

    // Try DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful genealogy AI assistant. Be concise.",
                },
                {
                  role: "user",
                  content: userContext
                    ? `Context: ${userContext}\n\nQ: ${query}`
                    : query,
                },
              ],
              max_tokens: 250,
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content || "";
          if (content) {
            return NextResponse.json({ response: content });
          }
        }
      } catch (e: any) {
        console.error("DeepSeek failed:", e.message);
        // Fall through to Gemini
      }
    }

    // Fallback to Gemini (no timeout wrapper - let it use its own)
    if (process.env.GEMINI_API_KEY) {
      const result = await askGenealogyAssistant({ query, userContext });
      return NextResponse.json({ response: result.response });
    }

    return NextResponse.json(
      { error: "No AI provider configured" },
      { status: 500 }
    );
  } catch (e: any) {
    console.error("API error:", e);
    return NextResponse.json(
      { error: "Service error", detail: e?.message ?? "" },
      { status: 500 }
    );
  }
}
