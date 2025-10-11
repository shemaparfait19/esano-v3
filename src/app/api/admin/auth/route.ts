import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// GET /api/admin/auth - Check if admin is authenticated
export async function GET() {
  try {
    const cookieStore = cookies();
    const adminSession = cookieStore.get("admin-session");

    if (!adminSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = JSON.parse(adminSession.value);

    // Check if session is still valid (7 days)
    const loginTime = new Date(session.loginTime);
    const now = new Date();
    const daysDiff =
      (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      admin: session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Authentication check failed" },
      { status: 500 }
    );
  }
}
