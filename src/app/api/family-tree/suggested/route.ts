import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/family-tree/suggested?limit=10
// Returns limited public data for discovery
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 30);

    const qs = await adminDb.collection("familyTrees").limit(limit).get();
    const items = await Promise.all(
      qs.docs.map(async (d) => {
        const t = d.data() as any;
        const head =
          (t.members || []).find((m: any) => m.isHeadOfFamily) ||
          (t.members || [])[0];
        const ownerSnap = await adminDb
          .collection("users")
          .doc(t.ownerId)
          .get();
        const owner = ownerSnap.exists ? (ownerSnap.data() as any) : null;
        return {
          ownerId: t.ownerId,
          ownerName:
            owner?.fullName ||
            owner?.preferredName ||
            owner?.firstName ||
            t.ownerId,
          headName:
            head?.fullName ||
            `${head?.firstName || ""} ${head?.lastName || ""}`.trim(),
          membersCount: (t.members || []).length,
          updatedAt: t.updatedAt,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load suggested trees", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
