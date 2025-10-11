import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// GET /api/admin/dashboard/stats
export async function GET() {
  try {
    // Get total users count
    const usersSnapshot = await adminDb.collection("users").get();
    const totalUsers = usersSnapshot.size;

    // Get applications stats
    const applicationsSnapshot = await adminDb
      .collection("familyTreeApplications")
      .get();
    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    const pendingApplications = applications.filter(
      (app) => app.status === "pending"
    ).length;
    const approvedApplications = applications.filter(
      (app) => app.status === "approved"
    ).length;

    // Get total family trees count
    const familyTreesSnapshot = await adminDb.collection("familyTrees").get();
    const totalFamilyTrees = familyTreesSnapshot.size;

    // Get recent activity (last 10 activities)
    const recentActivity = [];

    // Add recent applications
    const recentApplications = applications
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    recentApplications.forEach((app) => {
      recentActivity.push({
        id: `app-${app.id}`,
        type: "application",
        description: `New family tree application from ${app.userFullName}`,
        timestamp: app.createdAt,
      });
    });

    // Add recent user registrations
    const recentUsers = usersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 5);

    recentUsers.forEach((user) => {
      recentActivity.push({
        id: `user-${user.id}`,
        type: "registration",
        description: `New user registered: ${user.displayName || user.email}`,
        timestamp: user.createdAt,
      });
    });

    // Sort all activities by timestamp
    recentActivity.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      totalUsers,
      pendingApplications,
      approvedApplications,
      totalFamilyTrees,
      recentActivity: recentActivity.slice(0, 10),
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard stats", detail: error.message },
      { status: 500 }
    );
  }
}
