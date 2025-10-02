import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("=== TEST API CALLED ===");

    return NextResponse.json({
      message: "Test API working",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Test API error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
