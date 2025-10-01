import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FamilyTree } from "@/types/family-tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/family-tree - Load user's family tree
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const treeDoc = await adminDb.collection("familyTrees").doc(userId).get();

    if (!treeDoc.exists) {
      // Return empty tree structure
      const emptyTree: FamilyTree = {
        id: userId,
        ownerId: userId,
        members: [],
        edges: [],
        settings: {
          colorScheme: "default",
          viewMode: "classic",
          layout: "horizontal",
          branchColors: {},
          nodeStyles: {},
        },
        annotations: [],
        version: {
          current: 1,
          history: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return NextResponse.json({ tree: emptyTree });
    }

    const treeData = treeDoc.data() as FamilyTree;
    return NextResponse.json({ tree: treeData });
  } catch (error) {
    console.error("Error loading family tree:", error);
    return NextResponse.json(
      { error: "Failed to load family tree" },
      { status: 500 }
    );
  }
}

// POST /api/family-tree - Save user's family tree
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tree } = body;

    if (!userId || !tree) {
      return NextResponse.json(
        { error: "User ID and tree data are required" },
        { status: 400 }
      );
    }

    // Validate tree structure
    if (!tree.members || !Array.isArray(tree.members)) {
      return NextResponse.json(
        { error: "Invalid tree structure: members must be an array" },
        { status: 400 }
      );
    }

    if (!tree.edges || !Array.isArray(tree.edges)) {
      return NextResponse.json(
        { error: "Invalid tree structure: edges must be an array" },
        { status: 400 }
      );
    }

    // Update timestamps
    const updatedTree: FamilyTree = {
      ...tree,
      id: userId,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
      version: {
        ...tree.version,
        current: (tree.version?.current || 0) + 1,
        history: [
          ...(tree.version?.history || []),
          {
            id: `version_${Date.now()}`,
            ts: new Date().toISOString(),
            summary: `Updated tree with ${tree.members.length} members`,
            snapshotRef: "", // TODO: Store snapshot in separate collection
          },
        ].slice(-10), // Keep only last 10 versions
      },
    };

    await adminDb.collection("familyTrees").doc(userId).set(updatedTree);

    return NextResponse.json({
      success: true,
      tree: updatedTree,
      message: "Family tree saved successfully",
    });
  } catch (error) {
    console.error("Error saving family tree:", error);
    return NextResponse.json(
      { error: "Failed to save family tree" },
      { status: 500 }
    );
  }
}

// DELETE /api/family-tree - Delete user's family tree
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await adminDb.collection("familyTrees").doc(userId).delete();

    return NextResponse.json({
      success: true,
      message: "Family tree deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting family tree:", error);
    return NextResponse.json(
      { error: "Failed to delete family tree" },
      { status: 500 }
    );
  }
}
