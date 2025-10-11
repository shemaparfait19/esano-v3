import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateFamilyCode, validateFamilyCode } from "@/lib/family-code";

export const dynamic = "force-dynamic";

// POST /api/family-code/generate
export async function POST(request: Request) {
  try {
    const { userId, familyName } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user is a family head
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    if (!userData?.isFamilyHead) {
      return NextResponse.json(
        { error: "Only family heads can generate family codes" },
        { status: 403 }
      );
    }

    // Generate a unique family code
    let familyCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      familyCode = generateFamilyCode();
      attempts++;

      // Check if code already exists
      const existingCode = await adminDb
        .collection("familyCodes")
        .doc(familyCode)
        .get();

      if (!existingCode.exists) {
        break;
      }

      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: "Failed to generate unique family code" },
          { status: 500 }
        );
      }
    } while (true);

    // Create family code document
    const familyCodeData = {
      code: familyCode,
      generatedBy: userId,
      familyName: familyName || userData.displayName || "Family Tree",
      isActive: true,
      createdAt: new Date().toISOString(),
      // Optional: Set expiration (e.g., 1 year from now)
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await adminDb.collection("familyCodes").doc(familyCode).set(familyCodeData);

    return NextResponse.json({
      success: true,
      familyCode,
      formattedCode: `${familyCode.slice(0, 4)}-${familyCode.slice(4)}`,
      familyName: familyCodeData.familyName,
      expiresAt: familyCodeData.expiresAt,
    });
  } catch (error: any) {
    console.error("Family code generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate family code", detail: error.message },
      { status: 500 }
    );
  }
}
