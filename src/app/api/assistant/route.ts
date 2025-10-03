import { NextResponse } from "next/server";
import { askGenealogyAssistant } from "@/ai/flows/ai-genealogy-assistant";
import { adminDb } from "@/lib/firebase-admin";
async function buildKinshipFacts(userId: string) {
  try {
    const treeSnap = await adminDb.collection("familyTrees").doc(userId).get();
    if (!treeSnap.exists) return [] as string[];
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
    return facts.slice(0, 50);
  } catch {
    return [] as string[];
  }
}

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
    // Lightweight diagnostics endpoint to verify configuration without exposing secrets
    if (query === "__diag") {
      const hasGemini = Boolean(process.env.GEMINI_API_KEY);
      const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY);
      const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
      const hasServiceAccount = Boolean(process.env.SERVICE_ACCOUNT_JSON);
      let firebaseOk = false as boolean;
      let firebaseError = undefined as string | undefined;
      try {
        // Perform a harmless no-op access to ensure admin SDK is initialized
        await adminDb.collection("__diag").doc("ping").get();
        firebaseOk = true;
      } catch (e: any) {
        firebaseOk = false;
        firebaseError = e?.message ?? String(e);
      }
      return NextResponse.json({
        ok: true,
        hasGemini,
        hasDeepseek,
        hasOpenRouter,
        hasServiceAccount,
        firebaseOk,
        firebaseError,
        runtime,
        dynamic,
      });
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

        const p: any = profile || undefined;
        // Include a lightweight messages summary for personalization
        let messagesSummary: any[] | undefined = undefined;
        try {
          const msgSnap = await adminDb.collection("messages").get();
          const relevant = msgSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter(
              (m) =>
                m.senderId === subjectUserId || m.receiverId === subjectUserId
            )
            .sort((a, b) =>
              (b.createdAt || "").localeCompare(a.createdAt || "")
            )
            .slice(0, 20);
          messagesSummary = relevant.map((m) => ({
            peerId: m.senderId === subjectUserId ? m.receiverId : m.senderId,
            direction: m.senderId === subjectUserId ? "out" : "in",
            text: typeof m.text === "string" ? m.text.slice(0, 500) : "",
            createdAt: m.createdAt,
          }));
        } catch {}
        let kinship = subjectUserId
          ? await buildKinshipFacts(subjectUserId)
          : [];
        // Prepend head-of-family fact when available
        try {
          const headSnap = await adminDb
            .collection("familyTrees")
            .doc(subjectUserId!)
            .get();
          if (headSnap.exists) {
            const t = headSnap.data() as any;
            const head = (t.members || []).find((m: any) => m.isHeadOfFamily);
            if (head?.fullName) {
              kinship = [
                `${head.fullName} is the head of the family.`,
                ...kinship,
              ];
            }
          }
        } catch {}
        const relationTypes = [
          "parent",
          "spouse",
          "adoptive",
          "step",
          "big_sister",
          "little_sister",
          "big_brother",
          "little_brother",
          "aunt",
          "uncle",
          "cousin_big",
          "cousin_little",
          "guardian",
          "other",
        ];
        const ctx = {
          scope: scope || "own",
          subjectUserId,
          profile: p
            ? {
                // Legacy/basic
                fullName: p.fullName,
                birthPlace: p.birthPlace,
                clanOrCulturalInfo: p.clanOrCulturalInfo,
                relativesNames: p.relativesNames,
                // Personal
                firstName: p.firstName,
                middleName: p.middleName,
                lastName: p.lastName,
                preferredName: p.preferredName,
                birthDate: p.birthDate,
                gender: p.gender,
                nationality: p.nationality,
                nid: p.nid,
                maritalStatus: p.maritalStatus,
                phoneNumber: p.phoneNumber,
                email: p.email,
                province: p.province,
                district: p.district,
                sector: p.sector,
                cell: p.cell,
                village: p.village,
                preferredLanguage: p.preferredLanguage,
                profilePicture: p.profilePicture,
                // Residence
                residenceProvince: p.residenceProvince,
                residenceDistrict: p.residenceDistrict,
                residenceSector: p.residenceSector,
                residenceCell: p.residenceCell,
                residenceVillage: p.residenceVillage,
                streetName: p.streetName,
                // Social & relations
                socialMedias: p.socialMedias,
                location: p.location,
                spouseName: p.spouseName,
                // Education & Work (truncated for safety)
                education: Array.isArray(p.education)
                  ? p.education.slice(0, 10)
                  : undefined,
                work: Array.isArray(p.work) ? p.work.slice(0, 10) : undefined,
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
          messages: messagesSummary,
          kinship,
          capabilities: {
            relationTypes,
            headOfFamily: true,
            suggestApi: true,
          },
        };
        userContext = JSON.stringify(ctx);
      } catch {}
    }

    // If OpenRouter key is configured, use OpenRouter first with timeout
    if (process.env.OPENROUTER_API_KEY) {
      const systemPrompt =
        "You are a helpful AI assistant specialized in genealogy and DNA analysis. When available, use the provided user context to personalize guidance, but never reveal raw data.";
      const composedUser = userContext
        ? `User Context (JSON): ${userContext}\n\nQuestion: ${query}`
        : query;
      const orController = new AbortController();
      const orTimer = setTimeout(() => orController.abort(), 12000);
      const orResp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            // Identify the app per OpenRouter requirements to avoid 402/org issues
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost",
            "X-Title": process.env.OPENROUTER_APP_TITLE || "eSANO",
          },
          body: JSON.stringify({
            // Default to a widely available model; allow override via env
            model:
              process.env.OPENROUTER_MODEL ||
              process.env.NEXT_PUBLIC_OPENROUTER_MODEL ||
              "openrouter/auto",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: composedUser },
            ],
            max_tokens: 512,
            temperature: 0.2,
          }),
          signal: orController.signal,
        }
      );
      clearTimeout(orTimer);
      if (!orResp.ok) {
        let detailText = "";
        try {
          detailText = await orResp.text();
        } catch {}
        // Fallback to DeepSeek if configured, then Gemini
        if (process.env.DEEPSEEK_API_KEY) {
          // fall through to DeepSeek block below
        } else if (process.env.GEMINI_API_KEY) {
          const result = await withRetry(() =>
            askGenealogyAssistant({ query, userContext })
          );
          return NextResponse.json({ response: result.response });
        } else {
          return NextResponse.json(
            { error: "Assistant unavailable", detail: detailText },
            { status: 500 }
          );
        }
      } else {
        let orJson: any = null;
        try {
          orJson = await orResp.json();
        } catch {
          return NextResponse.json({
            response:
              "Assistant responded, but the format was unexpected. Please retry.",
          });
        }
        const content = orJson?.choices?.[0]?.message?.content ?? "";
        return NextResponse.json({ response: content || "" });
      }
    }

    // If DeepSeek key is configured, use DeepSeek API directly
    if (process.env.DEEPSEEK_API_KEY) {
      const systemPrompt =
        "You are a helpful AI assistant specialized in genealogy and DNA analysis. When available, use the provided user context to personalize guidance, but never reveal raw data.";
      const composedUser = userContext
        ? `User Context (JSON): ${userContext}\n\nQuestion: ${query}`
        : query;
      const dsResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: composedUser },
          ],
        }),
      });
      if (!dsResp.ok) {
        let detailText = await dsResp.text();
        try {
          const maybeJson = JSON.parse(detailText);
          const msg = maybeJson?.error?.message as string | undefined;
          const code = maybeJson?.error?.code as string | undefined;
          const isInsufficient =
            (code && code.toLowerCase().includes("insufficient")) ||
            (msg && msg.toLowerCase().includes("insufficient"));
          if (isInsufficient && process.env.GEMINI_API_KEY) {
            // Fallback to Gemini via Genkit
            const result = await withRetry(() =>
              askGenealogyAssistant({ query, userContext })
            );
            return NextResponse.json({ response: result.response });
          }
        } catch {}
        return NextResponse.json(
          { error: "Assistant unavailable", detail: detailText },
          { status: 500 }
        );
      }
      const dsJson: any = await dsResp.json();
      const content = dsJson?.choices?.[0]?.message?.content ?? "";
      return NextResponse.json({ response: content || "" });
    }

    // Otherwise, require Gemini and use Genkit flow
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set on server" },
        { status: 500 }
      );
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
