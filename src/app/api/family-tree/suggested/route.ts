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
    console.log(`Suggested trees: found ${qs.docs.length} trees`);

    // If no trees exist, return empty array
    if (qs.empty) {
      console.log("No family trees found in database");
      return NextResponse.json({ items: [] });
    }

    const items = await Promise.all(
      qs.docs.map(async (d) => {
        try {
          const t = d.data() as any;
          const head =
            (t.members || []).find((m: any) => m.isHeadOfFamily) ||
            (t.members || [])[0];

          let ownerName = t.ownerId;
          try {
            const ownerSnap = await adminDb
              .collection("users")
              .doc(t.ownerId)
              .get();
            const owner = ownerSnap.exists ? (ownerSnap.data() as any) : null;
            ownerName =
              owner?.fullName ||
              owner?.preferredName ||
              owner?.firstName ||
              t.ownerId;
          } catch (err) {
            // If user lookup fails, use ownerId
            console.warn("Failed to lookup owner:", err);
          }

          return {
            ownerId: t.ownerId,
            ownerName,
            headName:
              head?.fullName ||
              `${head?.firstName || ""} ${head?.lastName || ""}`.trim() ||
              "Family Tree",
            membersCount: (t.members || []).length,
            updatedAt: t.updatedAt || new Date().toISOString(),
          };
        } catch (err) {
          console.warn("Failed to process tree:", err);
          return null;
        }
      })
    );

    // Filter out null results
    const validItems = items.filter(Boolean);
    return NextResponse.json({ items: validItems });
  } catch (e: any) {
    console.error("Suggested trees error:", e);
    return NextResponse.json(
      { error: "Failed to load suggested trees", detail: e?.message || "" },
      { status: 500 }
    );
  }
}
