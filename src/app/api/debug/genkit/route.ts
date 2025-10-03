import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/ai/genkit";

export async function GET(_req: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY || "";
    const hasKey = key.length > 0;
    const masked = hasKey ? `${key.slice(0, 4)}***${key.slice(-4)}` : "";

    // Optional: super-light sanity call to ensure model can init
    let modelReady = false;
    try {
      // Create a tiny noop prompt without sending user data
      await ai.with({}).run(async () => {
        modelReady = true;
      });
    } catch {
      modelReady = false;
    }

    return NextResponse.json({
      ok: true,
      hasKey,
      maskedKey: masked,
      modelReady,
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to check Genkit" },
      { status: 500 }
    );
  }
}
