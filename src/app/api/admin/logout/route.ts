import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// POST /api/admin/logout
export async function POST() {
  try {
    const cookieStore = cookies();
    cookieStore.delete("admin-session");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
