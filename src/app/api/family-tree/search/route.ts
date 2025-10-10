import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/family-tree/search?q=smith&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 30);
    if (!q || q.length < 2) return NextResponse.json({ items: [] });

    // naive scan (for demo); production should use Algolia/ES or structured fields
    const qs = await adminDb.collection("familyTrees").limit(200).get();
    console.log(`Searching for "${q}", found ${qs.docs.length} trees to check`);
    const items: any[] = [];
    for (const doc of qs.docs) {
      const t = doc.data() as any;
      const head =
        (t.members || []).find((m: any) => m.isHeadOfFamily) ||
        (t.members || [])[0];
      const headName = (
        head?.fullName || `${head?.firstName || ""} ${head?.lastName || ""}`
      )
        .trim()
        .toLowerCase();
      const treeName = (t.title || t.familyName || "").toLowerCase();

      const ownerSnap = await adminDb.collection("users").doc(t.ownerId).get();
      const owner = ownerSnap.exists ? (ownerSnap.data() as any) : null;

      // ✅ Fixed: Safely handle undefined values
      const ownerName = (
        owner?.fullName ||
        owner?.preferredName ||
        owner?.firstName ||
        t.ownerId ||
        ""
      )
        .toString()
        .toLowerCase();

      if (
        headName.includes(q) ||
        treeName.includes(q) ||
        ownerName.includes(q)
      ) {
        console.log(
          `Match found: headName="${headName}", treeName="${treeName}", ownerName="${ownerName}"`
        );
        items.push({
          ownerId: t.ownerId,
          headName:
            head?.fullName ||
            `${head?.firstName || ""} ${head?.lastName || ""}`.trim(),
          ownerName:
            owner?.fullName ||
            owner?.preferredName ||
            owner?.firstName ||
            t.ownerId,
          membersCount: (t.members || []).length,
          updatedAt: t.updatedAt,
        });
      }
      if (items.length >= limit) break;
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error("Search error:", e); // Added logging for debugging
    return NextResponse.json(
      { error: "Search failed", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
