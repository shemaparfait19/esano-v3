import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// PATCH /api/admin/users/[userId]
export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    const updates = await request.json();

    // Validate allowed fields
    const allowedFields = ["isFamilyHead", "familyTreeApproved", "displayName"];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    filteredUpdates.updatedAt = new Date().toISOString();

    await adminDb.collection("users").doc(userId).update(filteredUpdates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user", detail: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId]
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // Delete user document
    await adminDb.collection("users").doc(userId).delete();

    // Also delete any related data (family trees, applications, etc.)
    // Note: This is a basic implementation. In production, you might want to
    // archive the data instead of deleting it completely.

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user", detail: error.message },
      { status: 500 }
    );
  }
}
