"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Eye, Heart, MapPin, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

interface FamilyTreeSuggestion {
  id: string;
  familyName?: string;
  members?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    isHeadOfFamily?: boolean;
    location?: string;
    birthDate?: string;
  }>;
  createdAt?: string;
  memberCount?: number;
  isPublic?: boolean;
}

interface FamilyTreeSuggestionsProps {
  className?: string;
}

export function FamilyTreeSuggestions({
  className,
}: FamilyTreeSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<FamilyTreeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FamilyTreeSuggestion[]>(
    []
  );
  const router = useRouter();

  // Load initial suggestions
  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/family-tree/suggestions");
      const data = await response.json();
      if (data.success) {
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/family-tree/suggestions?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.suggestions || []);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getHeadMember = (tree: FamilyTreeSuggestion) => {
    return tree.members?.find((m) => m.isHeadOfFamily) || tree.members?.[0];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString();
  };

  const displayTrees = searchQuery.trim() ? searchResults : suggestions;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-headline text-2xl font-bold text-primary">
            Discover Family Trees
          </h2>
          <p className="text-muted-foreground">
            Search and explore family trees shared by the community
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by family name or head of family..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : displayTrees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayTrees.map((tree) => {
            const headMember = getHeadMember(tree);
            const memberCount = tree.members?.length || tree.memberCount || 0;

            return (
              <Card key={tree.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {tree.familyName ||
                          `${headMember?.firstName || ""} ${
                            headMember?.lastName || ""
                          } Family`}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Head: {headMember?.firstName || ""}{" "}
                        {headMember?.lastName || ""}
                      </CardDescription>
                    </div>
                    <Badge variant={tree.isPublic ? "default" : "secondary"}>
                      {tree.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{memberCount} members</span>
                    </div>
                    {headMember?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{headMember.location}</span>
                      </div>
                    )}
                  </div>

                  {headMember?.birthDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Born: {formatDate(headMember.birthDate)}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        router.push(`/dashboard/family-tree?ownerId=${tree.id}`)
                      }
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Tree
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement request access functionality
                        console.log("Request access to tree:", tree.id);
                      }}
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      Request Access
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery.trim()
                  ? "No matching family trees found"
                  : "No family trees available"}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery.trim()
                  ? "Try adjusting your search terms or browse all available trees."
                  : "Check back later for family trees shared by the community."}
              </p>
              {searchQuery.trim() && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  Show All Trees
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
