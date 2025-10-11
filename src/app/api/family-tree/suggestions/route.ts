import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Family tree suggestions API called");

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || "";
    const limitCount = parseInt(searchParams.get("limit") || "10");

    console.log("📝 Search query:", searchQuery, "Limit:", limitCount);

    // Get all family trees that are public or shared
    const familyTreesRef = adminDb.collection("familyTrees");
    let q = familyTreesRef.limit(limitCount);

    console.log("🔗 Query created, executing...");

    // If there's a search query, we'll filter by family head name
    if (searchQuery.trim()) {
      // For now, we'll get all trees and filter by family head name
      // In a real implementation, you'd want to use Firestore's text search or Algolia
      const snapshot = await q.get();
      console.log("📊 Snapshot received, docs:", snapshot.docs.length);

      const trees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by family head name or family name
      const filteredTrees = trees.filter((tree) => {
        const headMember = tree.members?.find((m: any) => m.isHeadOfFamily);
        if (!headMember) return false;

        const searchLower = searchQuery.toLowerCase();
        const headName = `${headMember.firstName || ""} ${
          headMember.lastName || ""
        }`.toLowerCase();
        const familyName = tree.familyName?.toLowerCase() || "";

        return (
          headName.includes(searchLower) || familyName.includes(searchLower)
        );
      });

      console.log("✅ Filtered trees:", filteredTrees.length);

      return NextResponse.json({
        success: true,
        suggestions: filteredTrees.slice(0, limitCount),
        total: filteredTrees.length,
      });
    } else {
      // Get recent family trees
      const snapshot = await q.get();
      console.log("📊 Snapshot received, docs:", snapshot.docs.length);

      const trees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("✅ Returning trees:", trees.length);

      return NextResponse.json({
        success: true,
        suggestions: trees,
        total: trees.length,
      });
    }
  } catch (error) {
    console.error("❌ Error fetching family tree suggestions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch suggestions",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
