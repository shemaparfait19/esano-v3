import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-oauth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || undefined; // userId
    if (!code || !state)
      return NextResponse.redirect(
        new URL(`/dashboard/profile?oauth=failed`, req.url)
      );
    const tokens = await exchangeCodeForTokens(code);
    await adminDb
      .collection("oauthTokens")
      .doc(state)
      .set(
        { googleDrive: tokens, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    return NextResponse.redirect(
      new URL(`/dashboard/profile?oauth=ok`, req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/dashboard/profile?oauth=failed`, req.url)
    );
  }
}
