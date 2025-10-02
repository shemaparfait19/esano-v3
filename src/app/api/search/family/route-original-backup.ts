import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchResult {
  id: string;
  type: "user" | "family_member";
  name: string;
  matchScore: number;
  matchReasons: string[];
  preview: {
    location?: string;
    birthDate?: string;
    relationshipContext?: string;
    profilePicture?: string;
  };
  contactInfo?: {
    canConnect: boolean;
    connectionStatus?: "none" | "pending" | "connected";
  };
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
}

// Parse search query to extract names, locations, and other info
function parseSearchQuery(query: string) {
  const words = query.toLowerCase().trim().split(/\s+/);

  // Common Rwandan locations for location detection
  const rwandanLocations = [
    "kigali",
    "musanze",
    "huye",
    "rubavu",
    "nyagatare",
    "muhanga",
    "ruhango",
    "kayonza",
    "rusizi",
    "burera",
    "gicumbi",
    "nyanza",
    "karongi",
    "gasabo",
    "kicukiro",
    "nyarugenge",
    "northern",
    "southern",
    "eastern",
    "western",
    "province",
  ];

  const locations = words.filter((word) =>
    rwandanLocations.some((loc) => word.includes(loc) || loc.includes(word))
  );

  // Extract potential names (words not identified as locations)
  const nameWords = words.filter(
    (word) => !locations.some((loc) => word.includes(loc) || loc.includes(word))
  );

  return {
    nameWords,
    locations,
    fullQuery: query.toLowerCase().trim(),
  };
}

// Calculate match score based on various factors
function calculateMatchScore(
  searchTerms: ReturnType<typeof parseSearchQuery>,
  candidate: any,
  type: "user" | "family_member"
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  try {
    // Use actual database fields from UserProfile
    const candidateName = (
      candidate.fullName ||
      candidate.displayName ||
      `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() ||
      ""
    ).toLowerCase();

    const candidateLocation = (
      candidate.birthPlace ||
      candidate.province ||
      candidate.district ||
      candidate.residenceProvince ||
      candidate.residenceDistrict ||
      ""
    ).toLowerCase();

    // Name matching (highest weight)
    if (searchTerms.nameWords.length > 0) {
      const nameMatch = searchTerms.nameWords.some(
        (word) =>
          candidateName.includes(word) ||
          (word.length > 2 &&
            candidateName.includes(word.substring(0, word.length - 1)))
      );

      if (candidateName === searchTerms.fullQuery) {
        score += 100;
        reasons.push("Exact name match");
      } else if (nameMatch) {
        score += 80;
        reasons.push("Name match");
      }
    }

    // Location matching - check multiple location fields
    if (searchTerms.locations.length > 0) {
      const locationFields = [
        candidate.birthPlace,
        candidate.province,
        candidate.district,
        candidate.sector,
        candidate.cell,
        candidate.village,
        candidate.residenceProvince,
        candidate.residenceDistrict,
        candidate.residenceSector,
        candidate.residenceCell,
        candidate.residenceVillage,
      ]
        .filter(Boolean)
        .map((field) => field.toLowerCase());

      const locationMatch = searchTerms.locations.some((searchLoc) =>
        locationFields.some(
          (candidateLoc) =>
            candidateLoc.includes(searchLoc) || searchLoc.includes(candidateLoc)
        )
      );

      if (locationMatch) {
        score += 60;
        reasons.push("Location match");
      }
    }

    // Profile completeness bonus
    if (candidate.profilePicture) {
      score += 10;
      reasons.push("Has profile picture");
    }

    // Profile completion bonus
    if (candidate.profileCompleted) {
      score += 15;
      reasons.push("Complete profile");
    }

    // Birth date matching bonus
    if (candidate.birthDate && searchTerms.fullQuery.match(/\d{4}/)) {
      const yearInQuery = searchTerms.fullQuery.match(/\d{4}/)?.[0];
      if (yearInQuery && candidate.birthDate.includes(yearInQuery)) {
        score += 40;
        reasons.push("Birth year match");
      }
    }

    // Clan/cultural info bonus
    if (
      candidate.clanOrCulturalInfo &&
      searchTerms.nameWords.some((word) =>
        candidate.clanOrCulturalInfo.toLowerCase().includes(word)
      )
    ) {
      score += 25;
      reasons.push("Cultural background match");
    }

    // Relatives names matching
    if (candidate.relativesNames && Array.isArray(candidate.relativesNames)) {
      const relativesMatch = searchTerms.nameWords.some((searchWord) =>
        candidate.relativesNames.some((relativeName: string) =>
          relativeName.toLowerCase().includes(searchWord)
        )
      );
      if (relativesMatch) {
        score += 30;
        reasons.push("Related family member");
      }
    }

    // Recent activity bonus for users
    if (type === "user" && candidate.updatedAt) {
      const lastUpdate = new Date(candidate.updatedAt);
      const daysSinceUpdate =
        (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) {
        score += 10;
        reasons.push("Recently active");
      }
    }

    return { score, reasons };
  } catch (error) {
    console.error("Error in calculateMatchScore:", error);
    return { score: 0, reasons: ["Error calculating match"] };
  }
}

// Get connection status between current user and target user
async function getConnectionStatus(
  currentUserId: string,
  targetUserId: string
): Promise<"none" | "pending" | "connected"> {
  try {
    const connectionsRef = adminDb.collection("connections");

    // Check for existing connection
    const connectionQuery = await connectionsRef
      .where("requesterUid", "in", [currentUserId, targetUserId])
      .where("recipientUid", "in", [currentUserId, targetUserId])
      .get();

    if (connectionQuery.empty) {
      return "none";
    }

    const connection = connectionQuery.docs[0].data();
    return connection.status === "accepted" ? "connected" : "pending";
  } catch (error) {
    console.error("Error checking connection status:", error);
    return "none";
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    console.log("=== SEARCH API START ===");

    // Temporarily skip auth for debugging
    const currentUserId = "temp-user-id";

    // TODO: Re-enable auth after fixing database issues
    /*
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const currentUserId = decodedToken.uid;
    */

    // Get search parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
        suggestions: [
          "Try searching with a name and location",
          'Example: "Uwimana Musanze"',
        ],
      });
    }

    // For very short queries, return early with suggestions
    if (query.trim().length < 3) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
        suggestions: [
          "Please enter at least 3 characters",
          "Try: 'Uwimana', 'Marie', 'Kigali'",
        ],
      });
    }

    const searchTerms = parseSearchQuery(query);
    const results: SearchResult[] = [];

    console.log("Attempting to connect to Firebase...");

    // Test Firebase connection first
    let userSnapshot: any;
    try {
      const usersRef = adminDb.collection("users");
      console.log("Firebase reference created successfully");

      // Get all users and filter in memory for now (faster than multiple queries)
      userSnapshot = await usersRef.limit(100).get();
      console.log(`Found ${userSnapshot.size} users in database`);

      if (userSnapshot.empty) {
        console.log("Database is empty - no users found");
        return NextResponse.json({
          results: [],
          totalCount: 0,
          searchTime: Date.now() - startTime,
          message: "No users found in database",
        });
      }

      // Log first user to see data structure
      const firstDoc = userSnapshot.docs[0];
      console.log("Sample user ID:", firstDoc.id);
      console.log(
        "Sample user data:",
        JSON.stringify(firstDoc.data(), null, 2)
      );

      console.log(`Search terms:`, searchTerms);

      // Process user results
      for (const doc of userSnapshot.docs) {
        const userData = doc.data();

        // Skip current user
        if (doc.id === currentUserId) continue;

        try {
          const { score, reasons } = calculateMatchScore(
            searchTerms,
            userData,
            "user"
          );

          console.log(
            `User ${
              userData.fullName || userData.displayName || doc.id
            }: score=${score}, reasons=${reasons.join(", ")}`
          );

          // Include any results with some score (very low threshold for testing)
          if (score >= 1) {
            const connectionStatus = await getConnectionStatus(
              currentUserId,
              doc.id
            );

            results.push({
              id: doc.id,
              type: "user",
              name:
                userData.fullName ||
                userData.displayName ||
                `${userData.firstName || ""} ${
                  userData.lastName || ""
                }`.trim() ||
                "Unknown User",
              matchScore: score,
              matchReasons: reasons,
              preview: {
                location:
                  userData.birthPlace ||
                  userData.province ||
                  userData.district ||
                  userData.residenceProvince ||
                  userData.residenceDistrict,
                birthDate: userData.birthDate,
                profilePicture: userData.profilePicture,
              },
              contactInfo: {
                canConnect: connectionStatus === "none",
                connectionStatus,
              },
            });
          }
        } catch (userError) {
          console.error(`Error processing user ${doc.id}:`, userError);
          // Continue with next user instead of failing entire search
          continue;
        }
      }
    } catch (firebaseError: any) {
      console.error("Firebase connection error:", firebaseError);
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: firebaseError.message,
          results: [],
          totalCount: 0,
          searchTime: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    // Skip family tree search for now to improve performance
    // TODO: Re-enable with better indexing
    // const familyTreesRef = adminDb.collection("familyTrees");
    // const treeSnapshot = await familyTreesRef.limit(10).get();

    console.log(`Total results before filtering: ${results.length}`);

    // If no results found, return some users anyway for testing
    if (results.length === 0) {
      console.log("No matches found, returning sample users");
      for (const doc of userSnapshot.docs.slice(0, 5)) {
        if (doc.id === currentUserId) continue;
        const userData = doc.data();
        const connectionStatus = await getConnectionStatus(
          currentUserId,
          doc.id
        );

        results.push({
          id: doc.id,
          type: "user",
          name:
            userData.fullName ||
            userData.displayName ||
            `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
            "Unknown User",
          matchScore: 10, // Low score to indicate it's not a great match
          matchReasons: ["Sample result - no direct matches found"],
          preview: {
            location:
              userData.birthPlace || userData.province || userData.district,
            birthDate: userData.birthDate,
            profilePicture: userData.profilePicture,
          },
          contactInfo: {
            canConnect: connectionStatus === "none",
            connectionStatus,
          },
        });
      }
    }

    // Sort by match score and apply pagination
    results.sort((a, b) => b.matchScore - a.matchScore);
    const paginatedResults = results.slice(offset, offset + limit);

    const searchTime = Date.now() - startTime;

    console.log(`Returning ${paginatedResults.length} results`);

    const response: SearchResponse = {
      results: paginatedResults,
      totalCount: results.length,
      searchTime,
      suggestions:
        results.length === 0
          ? [
              "Try different spelling variations",
              "Include location information",
              "Use partial names if unsure",
            ]
          : undefined,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Search error:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error.message,
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
