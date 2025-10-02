import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";

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

  const candidateName = (
    candidate.fullName ||
    candidate.displayName ||
    ""
  ).toLowerCase();
  const candidateLocation = (
    candidate.currentCity ||
    candidate.birthPlace ||
    candidate.residence?.city ||
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

  // Location matching
  if (searchTerms.locations.length > 0) {
    const locationMatch = searchTerms.locations.some(
      (loc) =>
        candidateLocation.includes(loc) || loc.includes(candidateLocation)
    );

    if (locationMatch) {
      score += 60;
      reasons.push("Location match");
    }
  }

  // Profile completeness bonus
  if (candidate.profilePicture || candidate.photoURL) {
    score += 10;
    reasons.push("Has profile picture");
  }

  // Recent activity bonus for users
  if (type === "user" && candidate.lastLoginAt) {
    const lastLogin = new Date(candidate.lastLoginAt);
    const daysSinceLogin =
      (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin < 30) {
      score += 15;
      reasons.push("Recently active");
    }
  }

  return { score, reasons };
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get current user
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const currentUserId = decodedToken.uid;

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

    const searchTerms = parseSearchQuery(query);
    const results: SearchResult[] = [];

    // Search in users collection
    const usersRef = adminDb.collection("users");
    // For now, get all users and filter in memory (will optimize with indexes later)
    const userSnapshot = await usersRef.limit(100).get();

    // Process user results
    for (const doc of userSnapshot.docs) {
      const userData = doc.data();

      // Skip current user
      if (doc.id === currentUserId) continue;

      const { score, reasons } = calculateMatchScore(
        searchTerms,
        userData,
        "user"
      );

      // Only include results with meaningful scores
      if (score >= 20) {
        const connectionStatus = await getConnectionStatus(
          currentUserId,
          doc.id
        );

        results.push({
          id: doc.id,
          type: "user",
          name: userData.fullName || userData.displayName || "Unknown User",
          matchScore: score,
          matchReasons: reasons,
          preview: {
            location:
              userData.currentCity ||
              userData.birthPlace ||
              userData.residence?.city,
            birthDate: userData.birthDate,
            profilePicture: userData.profilePicture || userData.photoURL,
          },
          contactInfo: {
            canConnect: connectionStatus === "none",
            connectionStatus,
          },
        });
      }
    }

    // Search in family tree members (from all users' trees)
    const familyTreesRef = adminDb.collection("familyTrees");
    const treeSnapshot = await familyTreesRef.get();

    for (const treeDoc of treeSnapshot.docs) {
      const treeData = treeDoc.data();
      const members = treeData.members || [];

      for (const member of members) {
        // Skip if member is the current user
        if (member.id === currentUserId) continue;

        const { score, reasons } = calculateMatchScore(
          searchTerms,
          member,
          "family_member"
        );

        if (score >= 20) {
          results.push({
            id: member.id,
            type: "family_member",
            name: member.fullName || "Unknown Family Member",
            matchScore: score,
            matchReasons: reasons,
            preview: {
              location: member.birthPlace,
              birthDate: member.birthDate,
              relationshipContext: `In ${
                treeData.ownerName || "someone"
              }'s family tree`,
            },
            contactInfo: {
              canConnect: false, // Family tree members can't be directly contacted
              connectionStatus: "none",
            },
          });
        }
      }
    }

    // Sort by match score and apply pagination
    results.sort((a, b) => b.matchScore - a.matchScore);
    const paginatedResults = results.slice(offset, offset + limit);

    const searchTime = Date.now() - startTime;

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
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
