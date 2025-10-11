import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/users
export async function GET() {
  try {
    const usersSnapshot = await adminDb
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", detail: error.message },
      { status: 500 }
    );
  }
}
