import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    console.log("=== DEBUG API START ===");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    console.log(`Query: ${query}`);

    // Test 1: Basic API functionality
    const response: any = {
      step1: "Basic API working",
      query: query,
      timestamp: new Date().toISOString(),
    };

    // Test 2: Try importing Firebase admin
    try {
      console.log("Testing Firebase admin import...");
      const { adminDb } = await import("@/lib/firebase-admin");
      response.step2 = "Firebase admin imported successfully";
      console.log("Firebase admin imported successfully");

      // Test 3: Try creating a reference
      try {
        console.log("Testing Firestore reference...");
        const usersRef = adminDb.collection("users");
        response.step3 = "Firestore reference created successfully";
        console.log("Firestore reference created successfully");

        // Test 4: Try a simple query
        try {
          console.log("Testing Firestore query...");
          const snapshot = await usersRef.limit(1).get();
          response.step4 = `Firestore query successful - found ${snapshot.size} documents`;
          console.log(
            `Firestore query successful - found ${snapshot.size} documents`
          );

          if (!snapshot.empty) {
            const firstDoc = snapshot.docs[0];
            response.sampleData = {
              id: firstDoc.id,
              data: firstDoc.data(),
            };
          }
        } catch (queryError: any) {
          response.step4_error = queryError.message;
          console.error("Firestore query error:", queryError);
        }
      } catch (refError: any) {
        response.step3_error = refError.message;
        console.error("Firestore reference error:", refError);
      }
    } catch (importError: any) {
      response.step2_error = importError.message;
      console.error("Firebase import error:", importError);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Debug API error:", error);
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
