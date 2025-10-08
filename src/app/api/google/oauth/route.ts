import { NextResponse } from "next/server";
import { getDriveAuthUrl, exchangeCodeForTokens } from "@/lib/google-oauth";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/google/oauth?userId=... -> returns auth URL
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const url = getDriveAuthUrl(userId);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

// POST expects { code, state(userId) } from callback page (handled in route /api/google/oauth/callback)
export async function POST(req: Request) {
  try {
    const { code, state } = await req.json();
    if (!code || !state)
      return NextResponse.json(
        { error: "Missing code/state" },
        { status: 400 }
      );
    const tokens = await exchangeCodeForTokens(code);
    await adminDb
      .collection("oauthTokens")
      .doc(state)
      .set(
        { googleDrive: tokens, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
