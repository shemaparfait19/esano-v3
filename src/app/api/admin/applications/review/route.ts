import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/admin/applications/review - Review an application
export async function POST(request: Request) {
  try {
    const { applicationId, decision, adminNotes } = await request.json();

    if (!applicationId || !decision) {
      return NextResponse.json(
        { error: "Application ID and decision are required" },
        { status: 400 }
      );
    }

    if (decision === "denied" && !adminNotes?.trim()) {
      return NextResponse.json(
        { error: "Admin notes are required when denying an application" },
        { status: 400 }
      );
    }

    // Get the application
    const applicationDoc = await adminDb
      .collection("familyTreeApplications")
      .doc(applicationId)
      .get();

    if (!applicationDoc.exists) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const application = applicationDoc.data();

    if (application?.status !== "pending") {
      return NextResponse.json(
        { error: "Application has already been reviewed" },
        { status: 400 }
      );
    }

    // Update application
    await adminDb
      .collection("familyTreeApplications")
      .doc(applicationId)
      .update({
        status: decision,
        adminNotes: adminNotes || "",
        reviewedBy: "admin@esano.rw", // Admin user ID
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    // If approved, update user's family tree approval status
    if (decision === "approved") {
      await adminDb.collection("users").doc(application.userId).update({
        familyTreeApproved: true,
        isFamilyHead: true, // Approved users become family heads
        updatedAt: new Date().toISOString(),
      });
    }

    // Create notification for user
    const notificationType =
      decision === "approved" ? "application_approved" : "application_denied";
    const notificationTitle =
      decision === "approved"
        ? "Family Tree Application Approved"
        : "Family Tree Application Denied";
    const notificationMessage =
      decision === "approved"
        ? "Congratulations! Your family tree application has been approved. You can now create your family tree."
        : "Your family tree application has been reviewed. Please check the details for more information.";

    await adminDb.collection("notifications").add({
      userId: application.userId,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      payload: {
        applicationId,
        decision,
        adminNotes: adminNotes || "",
      },
      status: "unread",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Application ${decision} successfully`,
    });
  } catch (error: any) {
    console.error("Review application error:", error);
    return NextResponse.json(
      { error: "Failed to review application", detail: error.message },
      { status: 500 }
    );
  }
}
