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
    return facts.slice(0, 20);
  } catch {
    return [];
  }
}

// Recent messages fetcher (optional optimization)
async function getRecentMessages(userId: string) {
  try {
    const [sentDocs, receivedDocs] = await Promise.all([
      adminDb
        .collection("messages")
        .where("senderId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
      adminDb
        .collection("messages")
        .where("receiverId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
    ]);

    return [...sentDocs.docs, ...receivedDocs.docs].map((d) => {
      const data = d.data() as any;
      return {
        peerId: data.senderId === userId ? data.receiverId : data.senderId,
        direction: data.senderId === userId ? "out" : "in",
        text: typeof data.text === "string" ? data.text.slice(0, 150) : "",
        createdAt: data.createdAt,
      };
    });
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

    // === Diagnostics endpoint ===
    if (query === "__diag") {
      const hasGemini = Boolean(process.env.GEMINI_API_KEY);
      const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
      const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
      const openRouterKey = process.env.OPENROUTER_API_KEY
        ? `${process.env.OPENROUTER_API_KEY.slice(0, 10)}...`
        : "Not set";
      const geminiKey = process.env.GEMINI_API_KEY
        ? `${process.env.GEMINI_API_KEY.slice(0, 10)}...`
        : "Not set";
      return NextResponse.json({
        ok: true,
        hasGemini,
        hasDeepseek,
        hasOpenRouter,
        openRouterKey,
        geminiKey,
        timestamp: new Date().toISOString(),
      });
    }

    let subjectUserId: string | undefined = userId;

    // === Access validation for target user ===
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

    // === Simplified user context (faster) ===
    let userContext: string | undefined;
    if (subjectUserId) {
      try {
        // Only get basic profile info to avoid timeouts
        const profileSnap = await adminDb
          .collection("users")
          .doc(subjectUserId)
          .get();
        const profile = profileSnap.exists ? profileSnap.data() : undefined;

        if (profile) {
          userContext = JSON.stringify({
            name: profile.firstName
              ? `${profile.firstName} ${profile.lastName || ""}`.trim()
              : "User",
            location: profile.location || profile.birthPlace || "Unknown",
          });
        }
      } catch (e) {
        console.error("Context gathering failed:", e);
        // Continue without context rather than failing
      }
    }

    // === Try AI providers in sequence ===

    // 1️⃣ Gemini (primary) - direct API call
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("Attempting Gemini direct API with query:", query);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are a helpful genealogy AI assistant. Be concise and helpful.

${userContext ? `User context: ${userContext}\n\n` : ""}Question: ${query}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.3,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (content) {
            console.log("Gemini direct API success");
            return NextResponse.json({ response: content });
          }
        } else {
          const errorText = await response.text();
          console.error(
            "Gemini direct API failed:",
            response.status,
            errorText
          );
        }
      } catch (e: any) {
        console.error("Gemini direct API error:", e.message, e.stack);
        // Continue to next provider instead of failing
      }
    } else {
      console.log("GEMINI_API_KEY not found in environment");
    }

    // 2️⃣ OpenRouter (backup) with retry logic
    if (process.env.OPENROUTER_API_KEY) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // ⏱ 8s

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
                      "You are a helpful genealogy AI assistant. Be concise and helpful.",
                  },
                  {
                    role: "user",
                    content: userContext
                      ? `Context: ${userContext}\n\nQ: ${query}`
                      : query,
                  },
                ],
                max_tokens: 300,
                temperature: 0.3,
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || "";
            if (content) return NextResponse.json({ response: content });
          } else {
            const errorText = await response.text();
            console.error(
              `OpenRouter attempt ${attempt} failed:`,
              response.status,
              errorText
            );

            // If it's a 402 (insufficient credits) or 429 (rate limit), don't retry
            if (response.status === 402 || response.status === 429) {
              break;
            }

            // For other errors, wait before retry
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (e: any) {
          console.error(`OpenRouter attempt ${attempt} error:`, e.message);
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // 3️⃣ DeepSeek (final fallback)
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

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
          if (content) return NextResponse.json({ response: content });
        }
      } catch (e: any) {
        console.error("DeepSeek failed:", e.message);
      }
    }

    // If we get here, all providers failed - return a simple response instead of error
    return NextResponse.json({
      response:
        "I'm having trouble connecting to the AI service right now. Please try again in a moment, or try asking a shorter question.",
    });
  } catch (e: any) {
    console.error("API error:", e);
    return NextResponse.json(
      {
        error: "Service error",
        detail: e?.message ?? "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
