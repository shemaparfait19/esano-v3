import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Simple in-memory LRU cache (per serverless instance) to reduce duplicate reads
type CacheValue = { timestamp: number; ttlMs: number; payload: any };
const SEARCH_CACHE = new Map<string, CacheValue>();
const CACHE_MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 60 * 1000; // 60s short TTL for fresh results

// Lightweight public profiles cache for substring filtering without extra reads
type PublicProfile = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  location?: string;
};
const PUBLIC_CACHE: { profiles: PublicProfile[]; loadedAt: number } = {
  profiles: [],
  loadedAt: 0,
};
const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function warmPublicProfilesCache(): Promise<void> {
  if (Date.now() - PUBLIC_CACHE.loadedAt < PUBLIC_CACHE_TTL_MS) return;
  try {
    const collections = ["users", "profiles", "userProfiles"];
    const aggregated: PublicProfile[] = [];
    for (const coll of collections) {
      try {
        // Prefer completed profiles if field exists, otherwise take a capped sample
        let snap = await adminDb
          .collection(coll)
          .where("profileCompleted", "==", true)
          .limit(400)
          .get();
        if (snap.empty) {
          snap = await adminDb.collection(coll).limit(400).get();
        }
        snap.docs.forEach((d) => {
          const data: any = d.data();
          aggregated.push({
            id: d.id,
            name:
              data.name ||
              data.fullName ||
              `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            firstName: data.firstName || data.profile?.firstName,
            lastName: data.lastName || data.profile?.lastName,
            location:
              data.location ||
              data.profile?.location ||
              data.currentCity ||
              data.address?.city ||
              data.birthPlace,
          });
        });
      } catch {}
      if (aggregated.length >= 900) break; // cap total
    }
    PUBLIC_CACHE.profiles = aggregated;
    PUBLIC_CACHE.loadedAt = Date.now();
  } catch {}
}

function getCache(key: string) {
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttlMs) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  // refresh LRU order
  SEARCH_CACHE.delete(key);
  SEARCH_CACHE.set(key, entry);
  return entry.payload;
}

function setCache(key: string, payload: any, ttlMs: number = DEFAULT_TTL_MS) {
  if (SEARCH_CACHE.size >= CACHE_MAX_ENTRIES) {
    const firstKey = SEARCH_CACHE.keys().next().value;
    if (firstKey) SEARCH_CACHE.delete(firstKey);
  }
  SEARCH_CACHE.set(key, { timestamp: Date.now(), ttlMs, payload });
}

/**
 * Optimized Family Search API
 *
 * Best practices implemented:
 * - READ-ONLY operations (no writes during search)
 * - Small query limits to reduce reads
 * - Proper text search with range queries
 * - No logging/analytics writes
 * - Efficient query structure
 */

interface SearchResult {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  birthDate?: string;
  profilePicture?: string;
  bio?: string;
  matchScore: number;
  matchReasons: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 10); // Max 10 results
    const currentLocation =
      searchParams.get("currentLocation")?.toLowerCase() || "";
    const knownLocationsParam = searchParams.get("knownLocations") || "";
    const knownLocations = knownLocationsParam
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!query || query.length < 3) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "Query must be at least 3 characters",
      });
    }

    const userId = (searchParams.get("userId") || "").trim();
    const cacheKey = `q:${query}|l:${limit}|u:${userId}|cl:${currentLocation}|kl:${knownLocations.join(
      "|"
    )}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`🔍 Optimized search: "${query}" (limit: ${limit})`);

    // Parse search query for names and locations
    const searchTerms = parseSearchQuery(query);

    // Search users with optimized queries
    await warmPublicProfilesCache();

    const { results, debug } = await searchUsers(searchTerms, limit, {
      currentLocation,
      knownLocations,
      userId,
    });

    console.log(`✅ Found ${results.length} results for "${query}"`);

    // If substring filtering finds better public matches, merge and re-rank
    const merged = mergeWithPublicCache(results, searchTerms, limit);

    const payload = {
      success: true,
      results: merged,
      query,
      searchTerms,
      count: merged.length,
      debug,
    };

    // Cache positive and empty results briefly
    setCache(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("❌ Optimized search failed:", error);
    // Soft-fail to avoid UI breaking; return empty results rather than 500
    return NextResponse.json({
      success: true,
      results: [],
      query: undefined,
      searchTerms: undefined,
      count: 0,
      debug: {
        error: error instanceof Error ? error.message : "Search failed",
      },
    });
  }
}

/**
 * Parse search query into structured terms
 */
function parseSearchQuery(query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Rwandan location keywords
  const rwandanLocations = [
    "kigali",
    "musanze",
    "huye",
    "rubavu",
    "nyagatare",
    "muhanga",
    "karongi",
    "kayonza",
    "kirehe",
    "ngoma",
    "nyamasheke",
    "nyanza",
    "ruhango",
    "rulindo",
    "rusizi",
    "rwamagana",
    "burera",
    "gakenke",
    "gasabo",
    "gatsibo",
    "gicumbi",
    "gisagara",
    "nyarugenge",
    "kicukiro",
  ];

  const locations = terms.filter((term) =>
    rwandanLocations.some((loc) => loc.includes(term) || term.includes(loc))
  );

  const names = terms.filter(
    (term) => !locations.includes(term) && term.length >= 2
  );

  return {
    names,
    locations,
    fullQuery: query.toLowerCase(),
  };
}

/**
 * Search users with optimized Firestore queries
 */
async function searchUsers(
  searchTerms: any,
  limit: number,
  context?: {
    currentLocation?: string;
    knownLocations?: string[];
    userId?: string;
  }
): Promise<{ results: SearchResult[]; debug: any }> {
  const results: SearchResult[] = [];
  const seenIds = new Set<string>();
  let remainingBudget = Math.max(1, limit); // cap queries based on need
  const debug: any = { collectionTried: [], fieldsTried: [], boosts: {} };

  // Try different collection names (but limit to save quota)
  const possibleCollections = ["users", "profiles", "userProfiles"];
  let userCollection = "";

  // Find the correct collection (test with minimal reads)
  for (const collectionName of possibleCollections) {
    try {
      const testSnapshot = await adminDb
        .collection(collectionName)
        .limit(1)
        .get();
      if (!testSnapshot.empty) {
        userCollection = collectionName;
        console.log(`📍 Using collection: ${collectionName}`);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!userCollection) {
    console.log("⚠️ No user collection found");
    return { results: [], debug };
  }

  const collectionRef = adminDb.collection(userCollection);
  debug.collectionTried.push(userCollection);

  // Load known connections for boosting if userId present
  const connectedUserIds = new Set<string>();
  if (context?.userId) {
    try {
      const candidates = [
        "connections",
        "userConnections",
        "connectionRequests",
      ];
      for (const coll of candidates) {
        try {
          const snap = await adminDb
            .collection(coll)
            .where("status", "==", "connected")
            .where("participants", "array-contains", context.userId)
            .limit(50)
            .get();
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            const others: string[] = (data.participants || []).filter(
              (p: string) => p && p !== context.userId
            );
            others.forEach((id) => connectedUserIds.add(id));
          });
        } catch {}
      }
      debug.boosts.connectedCount = connectedUserIds.size;
    } catch {}
  }

  // Helper to run a prefix query on multiple possible fields
  async function runPrefixQuery(field: string, term: string) {
    if (remainingBudget <= 0) return;
    try {
      const snap = await collectionRef
        .where(field, ">=", term)
        .where(field, "<=", term + "\uf8ff")
        .limit(Math.min(10, remainingBudget))
        .get();
      debug.fieldsTried.push(field);
      snap.docs.forEach((doc) => {
        if (results.length < limit && !seenIds.has(doc.id)) {
          const user = processUserDoc(doc, searchTerms);
          if (user && user.matchScore > 0) {
            results.push(user);
            seenIds.add(doc.id);
            remainingBudget = Math.max(0, remainingBudget - 1);
          }
        }
      });
    } catch (e) {
      // ignore missing index/field
    }
  }

  // Search by names using efficient range queries (cap to ~3 fields per term)
  for (const name of searchTerms.names) {
    if (results.length >= limit) break;
    await runPrefixQuery("firstName", name);
    await runPrefixQuery("lastName", name);
    // fallback fields common in user schemas
    await runPrefixQuery("fullName", name);
    // nested paths commonly used
    await runPrefixQuery("profile.firstName", name);
    await runPrefixQuery("profile.lastName", name);
    await runPrefixQuery("profile.fullName", name);
    if (results.length >= limit) break;
  }

  // If we still need more results and have location terms, search by location
  if (results.length < limit && searchTerms.locations.length > 0) {
    for (const location of searchTerms.locations) {
      if (results.length >= limit) break;
      await runPrefixQuery("location", location);
      // broader location fields commonly used
      await runPrefixQuery("birthPlace", location);
      await runPrefixQuery("currentCity", location);
      await runPrefixQuery("profile.location", location);
      await runPrefixQuery("address.city", location);
    }
  }

  // Apply keyword relevance and context-aware scoring boosts (instant, lightweight)
  const userCurrentLoc = (context?.currentLocation || "").toLowerCase();
  const userKnownLocs = (context?.knownLocations || []).map((x) =>
    x.toLowerCase()
  );

  // Detect if query is primarily a location search
  const isMostlyLocationQuery =
    searchTerms.names.length === 0 && searchTerms.locations.length > 0;

  // Helper to score a field against query terms
  function scoreField(value: string | undefined, terms: string[]): number {
    if (!value) return 0;
    const v = value.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (!t) continue;
      if (v === t) s += 20; // exact match
      else if (v.startsWith(t)) s += 12; // prefix
      else if (v.includes(t)) s += 6; // substring
    }
    return s;
  }

  // Optionally filter by location for pure location queries
  const preFiltered = isMostlyLocationQuery
    ? results.filter((r) => {
        const loc = (r.location || "").toLowerCase();
        return searchTerms.locations.some((t) => loc.includes(t));
      })
    : results;

  const boosted = preFiltered.map((r) => {
    let boost = 0;
    const loc = (r.location || "").toLowerCase();
    const displayName = (r.name || "").toLowerCase();

    // Keyword relevance boosts (names and locations)
    boost += scoreField(displayName, searchTerms.names);
    boost += scoreField(loc, searchTerms.locations);

    if (userCurrentLoc && loc && loc.includes(userCurrentLoc)) boost += 5;
    if (
      userKnownLocs.length &&
      loc &&
      userKnownLocs.some((k) => loc.includes(k))
    )
      boost += 3;
    // Boost direct connections strongly
    if (connectedUserIds.has(r.id)) boost += 20;
    return { ...r, matchScore: r.matchScore + boost };
  });

  // Sort by match score and return top results
  let finalResults = boosted
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  // Last-resort tiny sample scan if still empty (avoid full collection scans)
  if (finalResults.length === 0 && searchTerms.names.length > 0) {
    try {
      const sampleSnap = await collectionRef.limit(10).get();
      debug.sampleScan = sampleSnap.size;
      sampleSnap.docs.forEach((doc) => {
        if (finalResults.length >= limit) return;
        const u = processUserDoc(doc, searchTerms);
        if (u && u.matchScore > 0) finalResults.push(u);
      });
    } catch {}
  }

  return { results: finalResults, debug };
}

/**
 * Merge Firestore results with public cache substring matches and re-rank
 */
function mergeWithPublicCache(results: any[], searchTerms: any, limit: number) {
  try {
    const terms = [...searchTerms.names, ...searchTerms.locations]
      .map((t: string) => t.toLowerCase())
      .filter(Boolean);

    // Score cached profiles by substring presence across fields
    const cacheMatches = PUBLIC_CACHE.profiles
      .map((p) => {
        const name = (p.name || "").toLowerCase();
        const loc = (p.location || "").toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (name.includes(t)) score += 8;
          if (loc.includes(t)) score += 10; // location heavier for place queries
        }
        return score > 0
          ? {
              id: p.id,
              type: "user" as const,
              name: p.name,
              matchScore: score,
              matchReasons: [],
              preview: { location: p.location },
              contactInfo: {
                canConnect: true,
                connectionStatus: "none" as const,
              },
            }
          : null;
      })
      .filter(Boolean) as any[];

    const byId = new Map<string, any>();
    [...results, ...cacheMatches].forEach((r) => {
      const prev = byId.get(r.id);
      if (!prev || r.matchScore > prev.matchScore) byId.set(r.id, r);
    });

    return Array.from(byId.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  } catch {
    return results.slice(0, limit);
  }
}

/**
 * Process user document and calculate match score
 */
function processUserDoc(doc: any, searchTerms: any): SearchResult | null {
  try {
    const data = doc.data();
    const displayName =
      (typeof data.name === "string" && data.name) ||
      (typeof data.fullName === "string" && data.fullName) ||
      `${(data.firstName || data.profile?.firstName || "")
        .toString()
        .trim()} ${(data.lastName || data.profile?.lastName || "")
        .toString()
        .trim()}`.trim();

    const user: SearchResult = {
      id: doc.id,
      name: displayName || doc.id,
      firstName: data.firstName || data.profile?.firstName,
      lastName: data.lastName || data.profile?.lastName,
      location:
        data.location ||
        data.profile?.location ||
        data.currentCity ||
        data.address?.city ||
        data.birthPlace,
      birthDate: data.birthDate,
      profilePicture: data.profilePicture,
      bio: data.bio,
      matchScore: 0,
      matchReasons: [],
    };

    // Calculate match score (no complex operations to save CPU)
    let score = 0;
    const reasons: string[] = [];

    // Name matching (high weight)
    for (const name of searchTerms.names) {
      if (user.firstName?.toLowerCase().includes(name)) {
        score += 10;
        reasons.push(`First name matches "${name}"`);
      }
      if (user.lastName?.toLowerCase().includes(name)) {
        score += 10;
        reasons.push(`Last name matches "${name}"`);
      }
      if (user.name?.toLowerCase().includes(name)) {
        score += 5;
        reasons.push(`Name contains "${name}"`);
      }
    }

    // Location matching (medium weight)
    for (const location of searchTerms.locations) {
      if (user.location?.toLowerCase().includes(location)) {
        score += 7;
        reasons.push(`Location matches "${location}"`);
      }
    }

    // Profile completeness bonus (low weight)
    if (user.profilePicture) score += 1;
    if (user.bio) score += 1;
    if (user.birthDate) score += 1;

    user.matchScore = score;
    user.matchReasons = reasons;

    return user;
  } catch (error) {
    console.log("⚠️ Error processing user doc:", error);
    return null;
  }
}
