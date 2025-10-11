import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
} from "firebase/firestore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || "";
    const limitCount = parseInt(searchParams.get("limit") || "10");

    // Get all family trees that are public or shared
    const familyTreesRef = collection(db, "familyTrees");
    let q = query(familyTreesRef, limit(limitCount));

    // If there's a search query, we'll filter by family head name
    if (searchQuery.trim()) {
      // For now, we'll get all trees and filter by family head name
      // In a real implementation, you'd want to use Firestore's text search or Algolia
      const snapshot = await getDocs(q);
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

      return NextResponse.json({
        success: true,
        suggestions: filteredTrees.slice(0, limitCount),
        total: filteredTrees.length,
      });
    } else {
      // Get recent family trees
      const snapshot = await getDocs(q);
      const trees = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({
        success: true,
        suggestions: trees,
        total: trees.length,
      });
    }
  } catch (error) {
    console.error("Error fetching family tree suggestions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
