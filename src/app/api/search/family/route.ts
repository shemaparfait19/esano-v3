import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchResult {
  id: string;
  type: "user";
  name: string;
  matchScore: number;
  matchReasons: string[];
  preview: {
    location?: string;
    birthDate?: string;
    profilePicture?: string;
  };
  contactInfo: {
    canConnect: boolean;
    connectionStatus: string;
  };
}

export async function GET(request: Request) {
  try {
    console.log("=== SEARCH API START ===");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    console.log(`Query received: ${query}`);

    if (!query || query.trim().length < 3) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        message: "Query must be at least 3 characters long",
      });
    }

    // Test Firebase connection and see what collections exist
    console.log("Testing Firebase connection...");

    try {
      // Try different possible collection names for user profiles
      const possibleCollections = [
        "users",
        "profiles",
        "userProfiles",
        "accounts",
      ];
      let userCollection = null;
      let userSnapshot = null;

      for (const collectionName of possibleCollections) {
        try {
          console.log(`Testing collection: ${collectionName}`);
          const testRef = adminDb.collection(collectionName);
          const testSnapshot = await testRef.limit(1).get();

          if (!testSnapshot.empty) {
            console.log(`Found data in collection: ${collectionName}`);
            userCollection = collectionName;
            // Get fewer documents to save quota
            userSnapshot = await testRef.limit(10).get();
            break;
          } else {
            console.log(`Collection ${collectionName} is empty`);
          }
        } catch (error) {
          console.log(
            `Collection ${collectionName} doesn't exist or error:`,
            error.message
          );
        }
      }

      if (!userSnapshot || userSnapshot.empty) {
        console.log("No user profiles found in any collection");
        return NextResponse.json({
          results: [],
          totalCount: 0,
          message: "No user profiles found in database",
          debug: "Checked collections: " + possibleCollections.join(", "),
        });
      }

      console.log(
        `Found ${userSnapshot.size} user profiles in collection: ${userCollection}`
      );

      // Log sample user data to understand the structure
      const firstUser = userSnapshot.docs[0];
      console.log("Sample user ID:", firstUser.id);
      console.log(
        "Sample user data:",
        JSON.stringify(firstUser.data(), null, 2)
      );

      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      // Search through user profiles
      for (const doc of userSnapshot.docs) {
        const userData = doc.data();

        // Extract name from various possible fields
        const possibleNames = [
          userData.fullName,
          userData.displayName,
          userData.name,
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
          userData.email?.split("@")[0], // fallback to email username
        ].filter(Boolean);

        const userName = possibleNames[0] || "Unknown User";

        // Extract location from various possible fields
        const possibleLocations = [
          userData.location,
          userData.address,
          userData.city,
          userData.province,
          userData.district,
          userData.birthPlace,
          userData.residenceProvince,
          userData.residenceDistrict,
        ].filter(Boolean);

        const userLocation = possibleLocations[0] || "";

        // Simple search matching
        let matchScore = 0;
        const matchReasons: string[] = [];

        // Check if query matches name
        if (userName.toLowerCase().includes(queryLower)) {
          matchScore += 100;
          matchReasons.push("Name match");
        }

        // Check if query matches location
        if (userLocation.toLowerCase().includes(queryLower)) {
          matchScore += 50;
          matchReasons.push("Location match");
        }

        // Check other fields
        const searchableText = [
          userData.bio,
          userData.description,
          userData.occupation,
          userData.clanOrCulturalInfo,
          ...(userData.relativesNames || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (searchableText.includes(queryLower)) {
          matchScore += 25;
          matchReasons.push("Profile match");
        }

        // If there's any match, add to results
        if (matchScore > 0) {
          results.push({
            id: doc.id,
            type: "user",
            name: userName,
            matchScore,
            matchReasons,
            preview: {
              location: userLocation,
              birthDate: userData.birthDate || userData.dateOfBirth,
              profilePicture: userData.profilePicture || userData.photoURL,
            },
            contactInfo: {
              canConnect: true,
              connectionStatus: "none",
            },
          });
        }
      }

      // Sort by match score
      results.sort((a, b) => b.matchScore - a.matchScore);

      console.log(`Found ${results.length} matching profiles`);

      // If no matches, return some sample users for testing
      if (results.length === 0) {
        console.log("No matches found, returning sample users");
        for (const doc of userSnapshot.docs.slice(0, 3)) {
          const userData = doc.data();
          const possibleNames = [
            userData.fullName,
            userData.displayName,
            userData.name,
            `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
            userData.email?.split("@")[0],
          ].filter(Boolean);

          results.push({
            id: doc.id,
            type: "user",
            name: possibleNames[0] || "Unknown User",
            matchScore: 10,
            matchReasons: ["Sample result - no direct matches found"],
            preview: {
              location:
                userData.location || userData.province || userData.district,
              birthDate: userData.birthDate || userData.dateOfBirth,
              profilePicture: userData.profilePicture || userData.photoURL,
            },
            contactInfo: {
              canConnect: true,
              connectionStatus: "none",
            },
          });
        }
      }

      return NextResponse.json({
        results: results.slice(0, 20), // Limit to 20 results
        totalCount: results.length,
        searchTime: 100,
        hasMore: results.length > 20,
        debug: {
          collection: userCollection,
          totalProfiles: userSnapshot.size,
          matchingProfiles: results.length,
        },
      });
    } catch (firebaseError: any) {
      console.error("Firebase error:", firebaseError);
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: firebaseError.message,
          results: [],
          totalCount: 0,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Search API error:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error.message,
        results: [],
        totalCount: 0,
      },
      { status: 500 }
    );
  }
}
