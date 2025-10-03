import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Starting Firestore usage analysis...");

    const collections = [
      "users",
      "profiles",
      "userProfiles",
      "accounts",
      "familyTrees",
      "familyTreeMembers",
      "familyTreeEdges",
      "connectionRequests",
      "connections",
      "userConnections",
      "messages",
      "notifications",
      "sessions",
      "logs",
      "analytics",
      "feedback",
      "uploads",
      "media",
    ];

    const usage = {
      totalCollections: 0,
      totalDocuments: 0,
      collections: [] as any[],
      largestCollections: [] as any[],
      suspiciousCollections: [] as any[],
    };

    for (const collectionName of collections) {
      try {
        console.log(`📊 Checking collection: ${collectionName}`);

        // Get collection reference
        const collectionRef = adminDb.collection(collectionName);

        // Count documents (limit to avoid quota issues)
        const snapshot = await collectionRef.limit(1000).get();
        const docCount = snapshot.size;

        if (docCount > 0) {
          usage.totalCollections++;
          usage.totalDocuments += docCount;

          // Sample first few docs to check structure
          const sampleDocs = snapshot.docs.slice(0, 3).map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              fieldCount: Object.keys(data).length,
              hasArrays: Object.values(data).some((v) => Array.isArray(v)),
              hasLargeObjects: Object.values(data).some(
                (v) =>
                  typeof v === "object" &&
                  v !== null &&
                  Object.keys(v).length > 10
              ),
              estimatedSize: JSON.stringify(data).length,
            };
          });

          const collectionInfo = {
            name: collectionName,
            documentCount: docCount,
            sampleDocs,
            avgFieldsPerDoc:
              sampleDocs.length > 0
                ? Math.round(
                    sampleDocs.reduce((sum, doc) => sum + doc.fieldCount, 0) /
                      sampleDocs.length
                  )
                : 0,
            avgSizePerDoc:
              sampleDocs.length > 0
                ? Math.round(
                    sampleDocs.reduce(
                      (sum, doc) => sum + doc.estimatedSize,
                      0
                    ) / sampleDocs.length
                  )
                : 0,
            estimatedTotalSize:
              sampleDocs.length > 0
                ? Math.round(
                    (sampleDocs.reduce(
                      (sum, doc) => sum + doc.estimatedSize,
                      0
                    ) /
                      sampleDocs.length) *
                      docCount
                  )
                : 0,
          };

          usage.collections.push(collectionInfo);

          // Flag suspicious collections
          if (docCount > 100) {
            usage.suspiciousCollections.push({
              ...collectionInfo,
              reason: `High document count: ${docCount}`,
            });
          }

          if (collectionInfo.avgSizePerDoc > 5000) {
            usage.suspiciousCollections.push({
              ...collectionInfo,
              reason: `Large documents: ${collectionInfo.avgSizePerDoc} chars avg`,
            });
          }
        }
      } catch (error) {
        console.log(
          `⚠️ Collection ${collectionName} doesn't exist or error:`,
          error
        );
      }
    }

    // Sort by estimated size
    usage.largestCollections = usage.collections
      .sort((a, b) => b.estimatedTotalSize - a.estimatedTotalSize)
      .slice(0, 5);

    console.log("📈 Usage analysis complete:", {
      totalCollections: usage.totalCollections,
      totalDocuments: usage.totalDocuments,
      largestCollections: usage.largestCollections.map(
        (c) => `${c.name}: ${c.documentCount} docs`
      ),
    });

    return NextResponse.json({
      success: true,
      usage,
      recommendations: generateRecommendations(usage),
    });
  } catch (error) {
    console.error("❌ Firestore usage analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(usage: any) {
  const recommendations = [];

  // Check for collections with too many docs
  const largeDocs = usage.collections.filter((c: any) => c.documentCount > 50);
  if (largeDocs.length > 0) {
    recommendations.push({
      type: "cleanup",
      priority: "high",
      message: `Collections with many documents: ${largeDocs
        .map((c: any) => `${c.name} (${c.documentCount})`)
        .join(", ")}`,
      action: "Consider deleting test data or old documents",
    });
  }

  // Check for large documents
  const heavyDocs = usage.collections.filter(
    (c: any) => c.avgSizePerDoc > 3000
  );
  if (heavyDocs.length > 0) {
    recommendations.push({
      type: "optimization",
      priority: "medium",
      message: `Collections with large documents: ${heavyDocs
        .map((c: any) => c.name)
        .join(", ")}`,
      action: "Consider breaking large objects into subcollections",
    });
  }

  // Check total document count
  if (usage.totalDocuments > 200) {
    recommendations.push({
      type: "cleanup",
      priority: "high",
      message: `Total documents: ${usage.totalDocuments}`,
      action: "This is likely causing quota issues. Clean up test data.",
    });
  }

  return recommendations;
}
