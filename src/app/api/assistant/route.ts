import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ==================== DATA FETCHING FUNCTIONS ====================

async function buildComprehensiveFamilyContext(userId: string) {
  try {
    console.log(`[Context] Building context for user: ${userId}`);

    const treeSnap = await adminDb.collection("familyTrees").doc(userId).get();
    if (!treeSnap.exists) {
      console.log(`[Context] No family tree found for user: ${userId}`);
      return { facts: [], members: [], relationships: [] };
    }

    const tree = treeSnap.data() as any;
    const members: Record<string, any> = Object.fromEntries(
      (tree.members || []).map((m: any) => [m.id, m])
    );
    const edges: any[] = tree.edges || [];

    console.log(
      `[Context] Found ${Object.keys(members).length} members and ${
        edges.length
      } edges`
    );

    // Build parent-child relationships
    const parentsOf = new Map<string, string[]>();
    const childrenOf = new Map<string, string[]>();
    const spousesOf = new Map<string, string[]>();

    edges.forEach((e: any) => {
      if (e.type === "parent") {
        parentsOf.set(e.toId, [...(parentsOf.get(e.toId) || []), e.fromId]);
        childrenOf.set(e.fromId, [...(childrenOf.get(e.fromId) || []), e.toId]);
      } else if (e.type === "spouse" || e.type === "partner") {
        spousesOf.set(e.fromId, [...(spousesOf.get(e.fromId) || []), e.toId]);
        spousesOf.set(e.toId, [...(spousesOf.get(e.toId) || []), e.fromId]);
      }
    });

    const facts: string[] = [];
    const relationships: string[] = [];

    // Helper to format person info
    const formatPerson = (id: string) => {
      const m = members[id];
      if (!m) return null;
      let info = m.fullName || m.firstName || "Unknown";
      if (m.birthDate) info += ` (born ${m.birthDate})`;
      if (m.birthPlace) info += ` from ${m.birthPlace}`;
      return info;
    };

    // Get user's info
    const userInfo = members[userId];
    if (userInfo) {
      facts.push(
        `I am ${userInfo.fullName || userInfo.firstName || "the user"}`
      );
      if (userInfo.birthDate) facts.push(`I was born on ${userInfo.birthDate}`);
      if (userInfo.birthPlace)
        facts.push(`I was born in ${userInfo.birthPlace}`);
      if (userInfo.deathDate)
        facts.push(`I passed away on ${userInfo.deathDate}`);
    }

    // Parents
    const myParents = parentsOf.get(userId) || [];
    myParents.forEach((pid) => {
      const info = formatPerson(pid);
      if (info) {
        facts.push(`${info} is my parent`);
        relationships.push(`parent: ${info}`);
      }
    });

    // Siblings (share at least one parent)
    const siblings = new Set<string>();
    myParents.forEach((pid) => {
      (childrenOf.get(pid) || []).forEach((cid) => {
        if (cid !== userId) siblings.add(cid);
      });
    });
    siblings.forEach((sid) => {
      const info = formatPerson(sid);
      if (info) {
        facts.push(`${info} is my sibling`);
        relationships.push(`sibling: ${info}`);
      }
    });

    // Grandparents
    myParents.forEach((pid) => {
      (parentsOf.get(pid) || []).forEach((gpid) => {
        const info = formatPerson(gpid);
        if (info) {
          facts.push(`${info} is my grandparent`);
          relationships.push(`grandparent: ${info}`);
        }
      });
    });

    // Children
    const myChildren = childrenOf.get(userId) || [];
    myChildren.forEach((cid) => {
      const info = formatPerson(cid);
      if (info) {
        facts.push(`${info} is my child`);
        relationships.push(`child: ${info}`);
      }
    });

    // Grandchildren
    myChildren.forEach((cid) => {
      (childrenOf.get(cid) || []).forEach((gcid) => {
        const info = formatPerson(gcid);
        if (info) {
          facts.push(`${info} is my grandchild`);
          relationships.push(`grandchild: ${info}`);
        }
      });
    });

    // Spouses/Partners
    const mySpouses = spousesOf.get(userId) || [];
    mySpouses.forEach((sid) => {
      const info = formatPerson(sid);
      if (info) {
        facts.push(`${info} is my spouse/partner`);
        relationships.push(`spouse: ${info}`);
      }
    });

    // Aunts/Uncles (parents' siblings)
    myParents.forEach((pid) => {
      const grandparents = parentsOf.get(pid) || [];
      grandparents.forEach((gpid) => {
        (childrenOf.get(gpid) || []).forEach((auid) => {
          if (auid !== pid) {
            const info = formatPerson(auid);
            if (info) {
              facts.push(`${info} is my aunt/uncle`);
              relationships.push(`aunt/uncle: ${info}`);
            }
          }
        });
      });
    });

    // Get all family members for comprehensive list
    const allMembers = Object.values(members).map((m: any) => {
      let desc = m.fullName || m.firstName || "Unknown";
      if (m.birthDate) desc += ` (b. ${m.birthDate})`;
      if (m.deathDate) desc += ` (d. ${m.deathDate})`;
      if (m.birthPlace) desc += ` - ${m.birthPlace}`;
      return desc;
    });

    console.log(`[Context] Generated ${facts.length} relationship facts`);

    return {
      facts: facts.slice(0, 50), // Limit to 50 most relevant facts
      members: allMembers.slice(0, 30), // Limit to 30 members
      relationships: relationships.slice(0, 30),
    };
  } catch (e) {
    console.error("[Context] Error building family context:", e);
    return { facts: [], members: [], relationships: [] };
  }
}

async function getUserProfile(userId: string) {
  try {
    const profileSnap = await adminDb.collection("users").doc(userId).get();
    if (!profileSnap.exists) return null;

    const profile = profileSnap.data() as any;
    return {
      name: profile.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : "User",
      email: profile.email || "",
      location: profile.location || profile.birthPlace || "Unknown",
      birthDate: profile.birthDate || "",
      birthPlace: profile.birthPlace || "",
    };
  } catch (e) {
    console.error("[Profile] Error fetching profile:", e);
    return null;
  }
}

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

    return [...sentDocs.docs, ...receivedDocs.docs]
      .map((d) => {
        const data = d.data() as any;
        return {
          peerId: data.senderId === userId ? data.receiverId : data.senderId,
          direction: data.senderId === userId ? "sent" : "received",
          text: typeof data.text === "string" ? data.text.slice(0, 150) : "",
          timestamp: data.createdAt,
        };
      })
      .slice(0, 10);
  } catch (e) {
    console.error("[Messages] Error fetching messages:", e);
    return [];
  }
}

// ==================== AI PROVIDER FUNCTIONS ====================

async function callGemini(prompt: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("[Gemini] API key not configured");
    return null;
  }

  try {
    console.log("[Gemini] Attempting API call...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini] API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (content) {
      console.log("[Gemini] ✅ Success");
      return content;
    }

    console.log("[Gemini] No content in response");
    return null;
  } catch (e: any) {
    console.error("[Gemini] Exception:", e.message);
    return null;
  }
}

async function callOpenRouter(
  prompt: string,
  attempt: number = 1
): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("[OpenRouter] API key not configured");
    return null;
  }

  try {
    console.log(`[OpenRouter] Attempt ${attempt}/2...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost",
          "X-Title": "eSANO Genealogy Assistant",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful genealogy AI assistant specializing in family history research. Be conversational, accurate, and helpful.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] API error ${response.status}:`, errorText);

      // Don't retry on auth/quota errors
      if (
        response.status === 402 ||
        response.status === 401 ||
        response.status === 429
      ) {
        return null;
      }

      // Retry once for other errors
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return callOpenRouter(prompt, attempt + 1);
      }
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (content) {
      console.log("[OpenRouter] ✅ Success");
      return content;
    }

    console.log("[OpenRouter] No content in response");
    return null;
  } catch (e: any) {
    console.error(`[OpenRouter] Exception on attempt ${attempt}:`, e.message);

    if (attempt < 2 && e.name !== "AbortError") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return callOpenRouter(prompt, attempt + 1);
    }
    return null;
  }
}

async function callDeepSeek(prompt: string): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("[DeepSeek] API key not configured");
    return null;
  }

  try {
    console.log("[DeepSeek] Attempting API call...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
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
              "You are a helpful genealogy AI assistant. Be concise and informative.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DeepSeek] API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (content) {
      console.log("[DeepSeek] ✅ Success");
      return content;
    }

    console.log("[DeepSeek] No content in response");
    return null;
  } catch (e: any) {
    console.error("[DeepSeek] Exception:", e.message);
    return null;
  }
}

// ==================== MAIN ROUTE HANDLER ====================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { query, userId, scope, targetUserId } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    console.log(`\n========== NEW REQUEST ==========`);
    console.log(`Query: "${query}"`);
    console.log(`User ID: ${userId}`);
    console.log(`Target User ID: ${targetUserId || "none"}`);

    // === Diagnostics endpoint ===
    if (query === "__diag") {
      const hasGemini = Boolean(process.env.GEMINI_API_KEY);
      const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
      const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

      return NextResponse.json({
        ok: true,
        hasGemini,
        hasDeepseek,
        hasOpenRouter,
        geminiKey: process.env.GEMINI_API_KEY
          ? `${process.env.GEMINI_API_KEY.slice(0, 10)}...`
          : "Not set",
        openRouterKey: process.env.OPENROUTER_API_KEY
          ? `${process.env.OPENROUTER_API_KEY.slice(0, 10)}...`
          : "Not set",
        deepseekKey: process.env.DEEPSEEK_API_KEY
          ? `${process.env.DEEPSEEK_API_KEY.slice(0, 10)}...`
          : "Not set",
        timestamp: new Date().toISOString(),
      });
    }

    let subjectUserId: string | undefined = userId;

    // === Access validation for target user ===
    if (targetUserId && targetUserId !== subjectUserId && subjectUserId) {
      console.log(
        `[Auth] Checking connection between ${subjectUserId} and ${targetUserId}`
      );

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
        console.log(`[Auth] ❌ Connection not found`);
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }

      console.log(`[Auth] ✅ Connection verified`);
      subjectUserId = targetUserId;
    }

    // === Build comprehensive context ===
    let contextParts: string[] = [];

    if (subjectUserId) {
      console.log(`[Context] Gathering data for user: ${subjectUserId}`);

      // Get user profile
      const profile = await getUserProfile(subjectUserId);
      if (profile) {
        contextParts.push(
          `USER PROFILE:\nName: ${profile.name}\nLocation: ${profile.location}`
        );
        if (profile.birthDate)
          contextParts.push(`Birth Date: ${profile.birthDate}`);
        if (profile.birthPlace)
          contextParts.push(`Birth Place: ${profile.birthPlace}`);
      }

      // Get family tree data
      const familyContext = await buildComprehensiveFamilyContext(
        subjectUserId
      );

      if (familyContext.facts.length > 0) {
        contextParts.push(
          `\nFAMILY RELATIONSHIPS:\n${familyContext.facts.join("\n")}`
        );
      }

      if (familyContext.members.length > 0) {
        contextParts.push(
          `\nALL FAMILY MEMBERS IN TREE:\n${familyContext.members.join("\n")}`
        );
      }

      // Get recent messages context (optional)
      const recentMessages = await getRecentMessages(subjectUserId);
      if (recentMessages.length > 0) {
        contextParts.push(
          `\nRECENT FAMILY COMMUNICATIONS:\n${recentMessages
            .map((m) => `- ${m.direction}: ${m.text}`)
            .join("\n")}`
        );
      }

      console.log(
        `[Context] Built context with ${contextParts.length} sections`
      );
    }

    // Build final prompt
    const contextString =
      contextParts.length > 0 ? contextParts.join("\n\n") : "";
    const fullPrompt = contextString
      ? `${contextString}\n\n---\n\nUser Question: ${query}\n\nPlease answer based on the context provided above. If the answer isn't in the context, say so clearly.`
      : `User Question: ${query}`;

    console.log(
      `[Prompt] Final prompt length: ${fullPrompt.length} characters`
    );

    // === Try AI providers in sequence ===
    let aiResponse: string | null = null;
    let providerUsed = "none";

    // Try Gemini first
    aiResponse = await callGemini(fullPrompt);
    if (aiResponse) providerUsed = "Gemini";

    // Try OpenRouter if Gemini failed
    if (!aiResponse) {
      aiResponse = await callOpenRouter(fullPrompt);
      if (aiResponse) providerUsed = "OpenRouter";
    }

    // Try DeepSeek as last resort
    if (!aiResponse) {
      aiResponse = await callDeepSeek(fullPrompt);
      if (aiResponse) providerUsed = "DeepSeek";
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Result] Provider: ${providerUsed} | Time: ${elapsed}ms`);
    console.log(`========== END REQUEST ==========\n`);

    // Return response
    if (aiResponse) {
      return NextResponse.json({
        response: aiResponse,
        meta: { provider: providerUsed, elapsed },
      });
    }

    // All providers failed
    console.error("[Error] All AI providers failed");
    return NextResponse.json({
      response:
        "I'm having trouble connecting to the AI service right now. Please try again in a moment. If the problem persists, please contact support.",
      meta: { provider: "none", elapsed },
    });
  } catch (e: any) {
    console.error("[Fatal Error]", e);
    return NextResponse.json(
      {
        error: "Service error",
        detail: e?.message ?? "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
