import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { FamilyTreeApplication } from "@/types/firestore";

export const dynamic = "force-dynamic";

// POST /api/family-tree/application - Submit family tree application
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userEmail, userFullName, applicationData } = body as {
      userId: string;
      userEmail: string;
      userFullName: string;
      applicationData: {
        reasonForTree: string;
        familyBackground: string;
        expectedMembers: number;
        culturalSignificance?: string;
        additionalInfo?: string;
      };
    };

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

    // Create application
    const application: FamilyTreeApplication = {
      userId,
      userEmail,
      userFullName,
      applicationData,
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

    return NextResponse.json({ applications });
  } catch (error: any) {
    console.error("Get application error:", error);
    return NextResponse.json(
      { error: "Failed to get application", detail: error.message },
      { status: 500 }
    );
  }
}
