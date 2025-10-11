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

    // Handle file uploads - store in Firestore as base64
    try {
      if (nationalIdFile) {
        const fileName = `nationalId_${Date.now()}_${nationalIdFile.name}`;
        const fileBuffer = await nationalIdFile.arrayBuffer();
        const base64Content = btoa(
          String.fromCharCode(...new Uint8Array(fileBuffer))
        );

        // Store file in Firestore
        const fileDoc = await adminDb.collection("uploadedDocuments").add({
          userId,
          fileName,
          fileType: nationalIdFile.type,
          fileSize: nationalIdFile.size,
          content: base64Content,
          uploadedAt: new Date().toISOString(),
          applicationId: null, // Will be updated after application is created
        });

        documents.nationalId = fileDoc.id;
        console.log(
          "National ID file uploaded:",
          fileName,
          "Doc ID:",
          fileDoc.id
        );
      }

      if (proofOfFamilyFile) {
        const fileName = `proofOfFamily_${Date.now()}_${
          proofOfFamilyFile.name
        }`;
        const fileBuffer = await proofOfFamilyFile.arrayBuffer();
        const base64Content = btoa(
          String.fromCharCode(...new Uint8Array(fileBuffer))
        );

        // Store file in Firestore
        const fileDoc = await adminDb.collection("uploadedDocuments").add({
          userId,
          fileName,
          fileType: proofOfFamilyFile.type,
          fileSize: proofOfFamilyFile.size,
          content: base64Content,
          uploadedAt: new Date().toISOString(),
          applicationId: null, // Will be updated after application is created
        });

        documents.proofOfFamily = fileDoc.id;
        console.log(
          "Proof of family file uploaded:",
          fileName,
          "Doc ID:",
          fileDoc.id
        );
      }

      if (guardianConsentFile) {
        const fileName = `guardianConsent_${Date.now()}_${
          guardianConsentFile.name
        }`;
        const fileBuffer = await guardianConsentFile.arrayBuffer();
        const base64Content = btoa(
          String.fromCharCode(...new Uint8Array(fileBuffer))
        );

        // Store file in Firestore
        const fileDoc = await adminDb.collection("uploadedDocuments").add({
          userId,
          fileName,
          fileType: guardianConsentFile.type,
          fileSize: guardianConsentFile.size,
          content: base64Content,
          uploadedAt: new Date().toISOString(),
          applicationId: null, // Will be updated after application is created
        });

        documents.guardianConsent = fileDoc.id;
        console.log(
          "Guardian consent file uploaded:",
          fileName,
          "Doc ID:",
          fileDoc.id
        );
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

    // Update document records with application ID
    if (documents.nationalId) {
      await adminDb
        .collection("uploadedDocuments")
        .doc(documents.nationalId)
        .update({
          applicationId: docRef.id,
        });
    }
    if (documents.proofOfFamily) {
      await adminDb
        .collection("uploadedDocuments")
        .doc(documents.proofOfFamily)
        .update({
          applicationId: docRef.id,
        });
    }
    if (documents.guardianConsent) {
      await adminDb
        .collection("uploadedDocuments")
        .doc(documents.guardianConsent)
        .update({
          applicationId: docRef.id,
        });
    }

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
    console.log("🔍 Family tree application GET API called");

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    console.log("👤 User ID:", userId);

    if (!userId) {
      console.log("❌ No user ID provided");
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Getting applications for user:", userId);

    // Get user's applications (most recent first)
    const applicationsSnapshot = await adminDb
      .collection("familyTreeApplications")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    console.log("📊 Applications snapshot:", applicationsSnapshot.docs.length);

    const applications = applicationsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("✅ Found applications:", applications.length);

    return NextResponse.json({
      applications: applications || [],
      hasApplication: applications.length > 0,
      status: applications.length > 0 ? applications[0].status : null,
      lastApplication: applications.length > 0 ? applications[0] : null,
    });
  } catch (error: any) {
    console.error("❌ Get application error:", error);
    return NextResponse.json(
      { error: "Failed to get application", detail: error.message },
      { status: 500 }
    );
  }
}
