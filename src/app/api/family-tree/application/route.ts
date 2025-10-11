import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { FamilyTreeApplication } from "@/types/firestore";

export const dynamic = "force-dynamic";

// POST /api/family-tree/application - Submit family tree application
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const userEmail = formData.get("userEmail") as string;
    const userFullName = formData.get("userFullName") as string;
    const applicationDataStr = formData.get("applicationData") as string;

    const applicationData = JSON.parse(applicationDataStr) as {
      fullName: string;
      nationalId: string;
      phoneNumber: string;
      address: string;
      reasonForTree: string;
      familyBackground: string;
      expectedMembers: number;
      isLegalGuardian: boolean;
      guardianName?: string;
      guardianRelationship?: string;
      guardianContact?: string;
      culturalSignificance?: string;
      additionalInfo?: string;
      agreeToTerms: boolean;
      confirmAccuracy: boolean;
      consentToVerification: boolean;
    };

    // Get uploaded files
    const nationalIdFile = formData.get("nationalId") as File | null;
    const proofOfFamilyFile = formData.get("proofOfFamily") as File | null;
    const guardianConsentFile = formData.get("guardianConsent") as File | null;

    if (!userId || !userEmail || !userFullName || !applicationData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already has a pending application
    const existingApplication = await adminDb
      .collection("familyTreeApplications")
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .get();

    if (!existingApplication.empty) {
      return NextResponse.json(
        { error: "You already have a pending application" },
        { status: 400 }
      );
    }

    // Check if user is already approved
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.familyTreeApproved) {
        return NextResponse.json(
          { error: "You are already approved to create family trees" },
          { status: 400 }
        );
      }
    }

    // Handle file uploads and store document URLs
    const documents: {
      nationalId?: string;
      proofOfFamily?: string;
      guardianConsent?: string;
    } = {};

    // Handle file uploads (simplified for serverless environment)
    try {
      // For now, just store file metadata instead of actual files
      // In production, you would upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
      if (nationalIdFile) {
        const fileName = `nationalId_${Date.now()}_${nationalIdFile.name}`;
        documents.nationalId = `uploaded:${fileName}`;
        console.log("National ID file uploaded:", fileName);
      }

      if (proofOfFamilyFile) {
        const fileName = `proofOfFamily_${Date.now()}_${
          proofOfFamilyFile.name
        }`;
        documents.proofOfFamily = `uploaded:${fileName}`;
        console.log("Proof of family file uploaded:", fileName);
      }

      if (guardianConsentFile) {
        const fileName = `guardianConsent_${Date.now()}_${
          guardianConsentFile.name
        }`;
        documents.guardianConsent = `uploaded:${fileName}`;
        console.log("Guardian consent file uploaded:", fileName);
      }
    } catch (fileError: any) {
      console.error("File upload error:", fileError);
      // Continue without documents if file upload fails
      console.log(
        "Continuing without document uploads due to file system error"
      );
    }

    // Create application
    const application: FamilyTreeApplication = {
      userId,
      userEmail,
      userFullName,
      applicationData,
      documents: Object.keys(documents).length > 0 ? documents : undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb
      .collection("familyTreeApplications")
      .add(application);

    // Create notification for user
    await adminDb.collection("notifications").add({
      userId,
      type: "application_submitted",
      title: "Family Tree Application Submitted",
      message:
        "Your family tree application has been submitted and is under review",
      payload: { applicationId: docRef.id },
      status: "unread",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      applicationId: docRef.id,
      message: "Application submitted successfully",
    });
  } catch (error: any) {
    console.error("Application submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit application", detail: error.message },
      { status: 500 }
    );
  }
}

// GET /api/family-tree/application?userId=... - Get user's application status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log("Getting applications for user:", userId);

    // Get user's applications (most recent first)
    const applicationsSnapshot = await adminDb
      .collection("familyTreeApplications")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const applications = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("Found applications:", applications.length);

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error("Get application error:", error);
    return NextResponse.json(
      { error: "Failed to get application", detail: error.message },
      { status: 500 }
    );
  }
}
