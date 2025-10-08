"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search as SearchIcon,
  Users,
  Heart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import SearchInput from "@/components/search/search-input";
import SearchResults from "@/components/search/search-results";
import { getCachedSearchResult, cacheSearchResult } from "@/lib/search-cache";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function SearchPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number>();
  const [totalCount, setTotalCount] = useState<number>();
  const [currentQuery, setCurrentQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [stats, setStats] = useState({
    activeUsers: 0,
    connectionsMade: 0,
    successRate: 0,
  });

  // Check for query parameter on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("q");
    if (queryParam && user) {
      performSearch(queryParam, false);
    }
  }, [user]);

  // Load real stats from database
  useEffect(() => {
    async function loadStats() {
      // Temporarily remove auth requirement for debugging
      try {
        const response = await fetch("/api/search/stats");

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
        // Don't show fake stats
        setStats({
          activeUsers: 0,
          connectionsMade: 0,
          successRate: 0,
        });
      }
    }

    loadStats();
  }, [user]);

  // Search function with caching
  const performSearch = useCallback(
    async (query: string, isLoadMore = false) => {
      if (!user) return;

      const currentOffset = isLoadMore ? offset : 0;
      const cacheKey = `${query}:${currentOffset}`;

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setResults([]);
        setOffset(0);

        // Check cache for initial search (not for load more)
        const cachedResult = getCachedSearchResult(query, { offset: 0 });
        if (cachedResult) {
          console.log("🎯 Using cached search results for:", query);
          setResults(cachedResult.results);
          setTotalCount(cachedResult.totalCount || cachedResult.results.length);
          setSearchTime(cachedResult.searchTime);
          setSuggestions(cachedResult.suggestions);
          setCurrentQuery(query);
          setOffset(cachedResult.results.length);
          setHasMore(cachedResult.results.length >= 10); // Assume more if we got full page
          setIsLoading(false);
          return;
        }
      }

      try {
        const startTime = Date.now();

        // Use optimized API with smaller limits
        const searchParams = new URLSearchParams({
          query,
          limit: "10", // Reduced from 20 to save quota
        });

        const response = await fetch(`/api/search/optimized?${searchParams}`);

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        const searchTime = Date.now() - startTime;

        // Transform results to match expected format
        const transformedResults = data.results.map((result: any) => ({
          id: result.id,
          type: "user" as const,
          name: result.name,
          matchScore: result.matchScore,
          matchReasons: result.matchReasons,
          preview: {
            location: result.location,
            birthDate: result.birthDate,
            profilePicture: result.profilePicture,
          },
          contactInfo: {
            canConnect: true,
            connectionStatus: "none" as const,
          },
        }));

        // Enrich with connection status for current user
        try {
          const conRef = collection(db, "connections");
          const [conA, conB] = await Promise.all([
            getDocs(
              query(
                conRef,
                where("participants", "array-contains", user.uid),
                where("status", "==", "connected")
              )
            ),
            getDocs(query(conRef, where("status", "==", "connected"))),
          ]);
          const connectedSet = new Set<string>();
          conA.docs.forEach((d) => {
            const arr = ((d.data() as any)?.participants || []) as string[];
            arr.forEach((id) => {
              if (id !== user.uid) connectedSet.add(id);
            });
          });
          // Mark connected in results
          transformedResults.forEach((r: any) => {
            if (connectedSet.has(r.id)) {
              r.contactInfo.connectionStatus = "connected";
              r.contactInfo.canConnect = false;
            }
          });
        } catch {}

        const searchResponse = {
          results: transformedResults,
          totalCount: transformedResults.length,
          searchTime,
          suggestions:
            transformedResults.length === 0
              ? [
                  "Try searching with different spelling",
                  "Use common Rwandan names like 'Uwimana' or 'Habimana'",
                  "Include location like 'Kigali' or 'Musanze'",
                ]
              : undefined,
        };

        if (isLoadMore) {
          setResults((prev) => [...prev, ...transformedResults]);
          setOffset((prev) => prev + transformedResults.length);
        } else {
          setResults(transformedResults);
          setOffset(transformedResults.length);
          setCurrentQuery(query);

          // Cache the result for future use
          cacheSearchResult(query, searchResponse, { offset: 0 });
        }

        setTotalCount(searchResponse.totalCount);
        setSearchTime(searchResponse.searchTime);
        setSuggestions(searchResponse.suggestions);
        setHasMore(false); // Optimized API returns all results at once
      } catch (error) {
        console.error("Search error:", error);
        setSuggestions([
          "Search failed. Please try again.",
          "Check your internet connection",
          "Try a simpler search term",
        ]);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [user, offset]
  );

  // Handle search input
  const handleSearch = useCallback(
    (query: string) => {
      performSearch(query, false);
    },
    [performSearch]
  );

  // Handle clear search
  const handleClear = useCallback(() => {
    setResults([]);
    setCurrentQuery("");
    setTotalCount(undefined);
    setSearchTime(undefined);
    setSuggestions(undefined);
    setOffset(0);
    setHasMore(false);
  }, []);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (currentQuery && hasMore && !isLoadingMore) {
      performSearch(currentQuery, true);
    }
  }, [currentQuery, hasMore, isLoadingMore, performSearch]);

  // Handle connection request
  const handleConnect = useCallback(
    async (userId: string) => {
      if (!user) return;

      const token = await user.getIdToken();
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientUid: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send connection request");
      }

      // Update the result to show pending status
      setResults((prev) =>
        prev.map((result) =>
          result.id === userId
            ? {
                ...result,
                contactInfo: {
                  ...result.contactInfo,
                  canConnect: false,
                  connectionStatus: "pending" as const,
                },
              }
            : result
        )
      );
    },
    [user]
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SearchIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Find Lost Family</h1>
            <p className="text-muted-foreground">
              Search for relatives using any information you remember
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-lg font-semibold">
                    {stats.activeUsers.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Heart className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Connections Made
                  </p>
                  <p className="text-lg font-semibold">
                    {stats.connectionsMade.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-lg font-semibold">{stats.successRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-8">
        <SearchInput
          onSearch={handleSearch}
          onClear={handleClear}
          isLoading={isLoading}
          className="max-w-2xl mx-auto"
          defaultValue={
            new URLSearchParams(
              typeof window !== "undefined" ? window.location.search : ""
            ).get("q") || ""
          }
        />
      </div>

      {/* Search Tips */}
      {!currentQuery && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Search Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">What to search for:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Full or partial names</li>
                  <li>• Last known locations</li>
                  <li>• Birth places or dates</li>
                  <li>• Any details you remember</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Example searches:</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Uwimana Kigali</Badge>
                  <Badge variant="outline">Marie 1985</Badge>
                  <Badge variant="outline">Habimana Musanze</Badge>
                  <Badge variant="outline">Mukamana Huye</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="mb-8" />

      {/* Search Results */}
      <SearchResults
        results={results}
        isLoading={isLoading}
        searchTime={searchTime}
        totalCount={totalCount}
        query={currentQuery}
        suggestions={suggestions}
        onConnect={handleConnect}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      />
    </div>
  );
}
