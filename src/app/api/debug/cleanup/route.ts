import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { action, collectionName, confirm } = await request.json();

    if (!confirm || confirm !== "YES_DELETE_ALL") {
      return NextResponse.json(
        {
          success: false,
          error: 'Must confirm with "YES_DELETE_ALL"',
        },
        { status: 400 }
      );
    }

    console.log(`🗑️ Starting cleanup action: ${action} on ${collectionName}`);

    switch (action) {
      case "delete_collection":
        return await deleteCollection(collectionName);

      case "delete_old_docs":
        return await deleteOldDocuments(collectionName);

      case "clean_test_data":
        return await cleanTestData(collectionName);

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function deleteCollection(collectionName: string) {
  const collectionRef = adminDb.collection(collectionName);
  let deletedCount = 0;

  // Delete in batches to avoid timeout
  while (true) {
    const snapshot = await collectionRef.limit(100).get();

    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += snapshot.size;

    console.log(
      `🗑️ Deleted ${snapshot.size} documents from ${collectionName}. Total: ${deletedCount}`
    );

    // Prevent infinite loops
    if (deletedCount > 10000) {
      break;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Deleted ${deletedCount} documents from ${collectionName}`,
    deletedCount,
  });
}

async function deleteOldDocuments(collectionName: string) {
  const collectionRef = adminDb.collection(collectionName);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7); // Delete docs older than 7 days

  let deletedCount = 0;

  try {
    // Try to find docs with createdAt field
    const snapshot = await collectionRef
      .where("createdAt", "<", cutoffDate)
      .limit(500)
      .get();

    if (!snapshot.empty) {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount = snapshot.size;
    }
  } catch (error) {
    console.log("⚠️ No createdAt field found, skipping old document cleanup");
  }

  return NextResponse.json({
    success: true,
    message: `Deleted ${deletedCount} old documents from ${collectionName}`,
    deletedCount,
  });
}

async function cleanTestData(collectionName: string) {
  const collectionRef = adminDb.collection(collectionName);
  let deletedCount = 0;

  // Common test data patterns
  const testPatterns = [
    "test",
    "Test",
    "TEST",
    "demo",
    "Demo",
    "DEMO",
    "sample",
    "Sample",
    "SAMPLE",
    "john",
    "John",
    "jane",
    "Jane",
    "doe",
    "Doe",
    "smith",
    "Smith",
  ];

  for (const pattern of testPatterns) {
    try {
      // Try name field
      let snapshot = await collectionRef
        .where("name", ">=", pattern)
        .where("name", "<=", pattern + "\uf8ff")
        .limit(100)
        .get();

      if (!snapshot.empty) {
        const batch = adminDb.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        deletedCount += snapshot.size;
      }

      // Try firstName field
      snapshot = await collectionRef
        .where("firstName", ">=", pattern)
        .where("firstName", "<=", pattern + "\uf8ff")
        .limit(100)
        .get();

      if (!snapshot.empty) {
        const batch = adminDb.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        deletedCount += snapshot.size;
      }
    } catch (error) {
      // Field might not exist, continue
      console.log(`⚠️ Field not indexed for pattern ${pattern}`);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Cleaned ${deletedCount} test documents from ${collectionName}`,
    deletedCount,
  });
}

export async function GET() {
  return NextResponse.json({
    message: "Firestore Cleanup API",
    actions: [
      "delete_collection - Delete entire collection",
      "delete_old_docs - Delete documents older than 7 days",
      "clean_test_data - Delete documents with test/demo names",
    ],
    usage: 'POST with { action, collectionName, confirm: "YES_DELETE_ALL" }',
  });
}
