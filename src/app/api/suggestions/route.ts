import { NextResponse } from "next/server";
import { getSuggestedMatches } from "@/app/actions";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const suggestions = await getSuggestedMatches(userId);
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to load suggestions" },
      { status: 500 }
    );
  }
}
