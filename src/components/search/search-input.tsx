"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchInputProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}

export default function SearchInput({
  onSearch,
  onClear,
  isLoading = false,
  placeholder = "Search for family members... (e.g., 'Uwimana Musanze')",
  className = "",
  defaultValue,
}: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Initialize from defaultValue (e.g., ?q=...)
  useEffect(() => {
    if (defaultValue && defaultValue.trim().length > 0) {
      setQuery(defaultValue);
      setDebouncedQuery(defaultValue);
    }
  }, [defaultValue]);

  // Debounce the search query (500ms for quota-friendly searching)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500); // 500ms debounce delay to reduce Firestore reads

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 3) {
      onSearch(debouncedQuery.trim());
    } else if (debouncedQuery.trim().length === 0) {
      onClear();
    }
  }, [debouncedQuery, onSearch, onClear]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    []
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    onClear();
  }, [onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear]
  );

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-20 h-12 text-base"
          autoComplete="off"
          spellCheck="false"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 w-8 p-0 hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search hints */}
      {query.length > 0 && query.length < 3 && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
          Type at least 3 characters to search
        </div>
      )}

      {/* Search suggestions */}
      {query.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-card border rounded-md shadow-sm">
          <p className="text-sm text-muted-foreground mb-2">Search examples:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Uwimana Kigali",
              "Marie Musanze",
              "Habimana Huye",
              "Mukamana Rubavu",
            ].map((example) => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
