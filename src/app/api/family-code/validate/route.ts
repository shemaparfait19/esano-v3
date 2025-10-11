import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { validateFamilyCode } from "@/lib/family-code";

export const dynamic = "force-dynamic";

// POST /api/family-code/validate
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Family code is required" },
        { status: 400 }
      );
    }

    // Clean the code (remove dashes and convert to uppercase)
    const cleanCode = code.replace(/-/g, "").toUpperCase();

    // Validate format
    if (!validateFamilyCode(cleanCode)) {
      return NextResponse.json(
        { error: "Invalid family code format" },
        { status: 400 }
      );
    }

    // Check if family code exists and is active
    const familyCodeDoc = await adminDb
      .collection("familyCodes")
      .doc(cleanCode)
      .get();

    if (!familyCodeDoc.exists) {
      return NextResponse.json(
        { error: "Family code not found" },
        { status: 404 }
      );
    }

    const familyCodeData = familyCodeDoc.data();

    if (!familyCodeData?.isActive) {
      return NextResponse.json(
        { error: "Family code is no longer active" },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (familyCodeData.expiresAt) {
      const expiresAt = new Date(familyCodeData.expiresAt);
      const now = new Date();

      if (now > expiresAt) {
        return NextResponse.json(
          { error: "Family code has expired" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      valid: true,
      familyCode: cleanCode,
      generatedBy: familyCodeData.generatedBy,
      familyName: familyCodeData.familyName,
    });
  } catch (error: any) {
    console.error("Family code validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate family code", detail: error.message },
      { status: 500 }
    );
  }
}
