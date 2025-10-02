"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Clock, AlertCircle, Lightbulb } from "lucide-react";
import ResultCard from "./result-card";

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

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  searchTime?: number;
  totalCount?: number;
  query?: string;
  suggestions?: string[];
  onConnect?: (userId: string) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export default function SearchResults({
  results,
  isLoading,
  searchTime,
  totalCount,
  query,
  suggestions,
  onConnect,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: SearchResultsProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Search className="h-4 w-4 animate-pulse" />
          <span>Searching...</span>
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // No query state
  if (!query || query.trim().length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Search for Lost Family</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Enter any information you remember about the person you're looking for
          - their name, location, or other details.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="outline" className="text-sm">
            Names: Uwimana, Habimana, Mukamana
          </Badge>
          <Badge variant="outline" className="text-sm">
            Locations: Kigali, Musanze, Huye
          </Badge>
        </div>
      </div>
    );
  }

  // No results found
  if (results.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No matches found</h3>
        <p className="text-muted-foreground mb-6">
          We couldn't find anyone matching "{query}". Try adjusting your search.
        </p>

        {suggestions && suggestions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-sm">Search Tips:</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index}>• {suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Results found
  return (
    <div className="space-y-4">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {totalCount
              ? `${totalCount} result${totalCount !== 1 ? "s" : ""}`
              : `${results.length} result${results.length !== 1 ? "s" : ""}`}
            {query && ` for "${query}"`}
          </span>
        </div>
        {searchTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{searchTime}ms</span>
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map((result) => (
          <ResultCard
            key={`${result.type}-${result.id}`}
            result={result}
            onConnect={onConnect}
          />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading more...
              </div>
            ) : (
              "Load more results"
            )}
          </button>
        </div>
      )}

      {/* Search suggestions */}
      {suggestions && suggestions.length > 0 && results.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-yellow-600" />
            <span className="font-medium text-sm">Improve your search:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
