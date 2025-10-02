import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    console.log("=== SIMPLE SEARCH API START ===");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    console.log(`Query: ${query}`);

    if (!query || query.trim().length < 3) {
      return NextResponse.json({
        results: [],
        totalCount: 0,
        message: "Query must be at least 3 characters long",
      });
    }

    // Return mock data for now
    const mockResults = [
      {
        id: "1",
        type: "user",
        name: "Jean Baptiste Uwimana",
        matchScore: 85,
        matchReasons: ["Name match"],
        preview: {
          location: "Kigali, Rwanda",
          birthDate: "1990-01-15",
          profilePicture: null,
        },
        contactInfo: {
          canConnect: true,
          connectionStatus: "none",
        },
      },
      {
        id: "2",
        type: "user",
        name: "Marie Claire Mukamana",
        matchScore: 70,
        matchReasons: ["Location match"],
        preview: {
          location: "Musanze, Rwanda",
          birthDate: "1985-03-22",
          profilePicture: null,
        },
        contactInfo: {
          canConnect: true,
          connectionStatus: "none",
        },
      },
    ];

    // Filter results based on query
    const filteredResults = mockResults.filter((result) =>
      result.name.toLowerCase().includes(query.toLowerCase())
    );

    console.log(`Returning ${filteredResults.length} results`);

    return NextResponse.json({
      results: filteredResults,
      totalCount: filteredResults.length,
      searchTime: 50,
      hasMore: false,
    });
  } catch (error: any) {
    console.error("Simple search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
