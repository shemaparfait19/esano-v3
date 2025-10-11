import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// POST /api/admin/login
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check admin credentials
    if (email === "admin@esano.rw" && password === "admin123") {
      // Create admin session
      const adminSession = {
        email: "admin@esano.rw",
        role: "super_admin",
        loginTime: new Date().toISOString(),
      };

      // Set session cookie
      const cookieStore = cookies();
      cookieStore.set("admin-session", JSON.stringify(adminSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // Update last login time in database
      await adminDb
        .collection("adminUsers")
        .doc("admin@esano.rw")
        .set(
          {
            email: "admin@esano.rw",
            displayName: "Esano Administrator",
            role: "super_admin",
            permissions: ["all"],
            isActive: true,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

      return NextResponse.json({
        success: true,
        admin: {
          email: "admin@esano.rw",
          role: "super_admin",
        },
      });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Login failed", detail: error.message },
      { status: 500 }
    );
  }
}
