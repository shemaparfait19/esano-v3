import { NextResponse } from "next/server";
import {
  addFamilyMember,
  getFamilyTree,
  linkFamilyRelation,
} from "@/app/actions";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    const tree = await getFamilyTree(userId);
    return NextResponse.json({ tree });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load tree" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.type === "member") {
      const { ownerUserId, member } = body;
      if (!ownerUserId || !member)
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
      const updated = await addFamilyMember(ownerUserId, member);
      return NextResponse.json({ tree: updated });
    }
    if (body.type === "edge") {
      const { ownerUserId, edge } = body;
      if (!ownerUserId || !edge)
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
      const updated = await linkFamilyRelation(ownerUserId, edge);
      return NextResponse.json({ tree: updated });
    }
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to update tree" },
      { status: 500 }
    );
  }
}
