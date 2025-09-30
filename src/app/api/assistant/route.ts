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
        };
        userContext = JSON.stringify(ctx);
      } catch {}
    }

    // If OpenRouter key is configured, use OpenRouter first
    if (process.env.OPENROUTER_API_KEY) {
      const systemPrompt =
        "You are a helpful AI assistant specialized in genealogy and DNA analysis. When available, use the provided user context to personalize guidance, but never reveal raw data.";
      const composedUser = userContext
        ? `User Context (JSON): ${userContext}\n\nQuestion: ${query}`
        : query;
      const orResp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Default to a widely available model; allow override via env
            model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: composedUser },
            ],
          }),
        }
      );
      if (!orResp.ok) {
        const detailText = await orResp.text();
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
        const orJson: any = await orResp.json();
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
