// @ts-nocheck
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppContext } from "@/contexts/app-context";
import {
  ArrowRight,
  Dna,
  Globe,
  Users,
  BarChart,
  Bot,
  Search,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { FamilyCodeGenerator } from "@/components/family-tree/family-code-generator";
import { FamilyTreeSuggestions } from "@/components/dashboard/family-tree-suggestions";
import { useRouter } from "next/navigation";

type SuggestedMatch = {
  userId: string;
  fullName?: string;
  score: number;
  reasons: string[];
};

const features = [
  {
    title: "DNA Analysis",
    description: "Upload your raw DNA file to begin your journey.",
    href: "/dashboard/dna-analysis",
    icon: Dna,
  },
  {
    title: "Find Relatives",
    description: "Discover and connect with potential family members.",
    href: "/dashboard/relatives",
    icon: Users,
  },
  {
    title: "Explore Ancestry",
    description: "See your ethnicity estimates and geographic origins.",
    href: "/dashboard/ancestry",
    icon: Globe,
  },
  {
    title: "View Insights",
    description: "Learn about your genetic traits and heritage.",
    href: "/dashboard/insights",
    icon: BarChart,
  },
];

export default function DashboardPage() {
  const { analysisCompleted, relatives, ancestry } = useAppContext();
  const { userProfile, user } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestedMatch[] | null>(null);
  const [incomingCount, setIncomingCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [inlineResults, setInlineResults] = useState<any[]>([]);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineLoading, setInlineLoading] = useState(false);

  // Short ancestry teaser for dashboard card
  const ancestryPreview = (() => {
    const raw = ancestry?.ethnicityEstimates as any as string | undefined;
    if (!raw || typeof raw !== "string") return "No ancestry data available.";
    // If Gemini returned a long report, extract the first meaningful sentence
    const cleaned = raw
      .replace(/^\s*Detailed\s+Ancestry\s+Report:?\s*/i, "")
      .replace(/^#+\s*/gm, "")
      .trim();
    // Prefer text before the first double newline or first period
    const firstBlock = cleaned.split(/\n\n/)[0] || cleaned;
    const firstSentence = firstBlock.split(/(?<=\.)\s/)[0] || firstBlock;
    const snippet = firstSentence.slice(0, 160);
    return snippet.endsWith(".") ? snippet : `${snippet}...`;
  })();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Check if the search query looks like a family tree search
      const query = searchQuery.trim().toLowerCase();
      const familyTreeKeywords = [
        "family",
        "tree",
        "ancestor",
        "relative",
        "genealogy",
      ];
      const isFamilyTreeSearch = familyTreeKeywords.some((keyword) =>
        query.includes(keyword)
      );

      if (isFamilyTreeSearch) {
        // Redirect to family tree suggestions with search
        router.push(
          `/dashboard/family-tree?search=${encodeURIComponent(
            searchQuery.trim()
          )}`
        );
      } else {
        // Regular search for relatives
        router.push(
          `/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Debounce dashboard search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Inline live search using optimized endpoint with strict limit
  const fetchInlineResults = useCallback(async (q: string) => {
    if (!q || q.trim().length < 3) {
      setInlineResults([]);
      setInlineOpen(false);
      return;
    }
    try {
      setInlineLoading(true);
      const params = new URLSearchParams({ query: q.trim(), limit: "5" });
      const res = await fetch(`/api/search/optimized?${params}`);
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setInlineResults(data.results || []);
      setInlineOpen((data.results || []).length > 0);
    } catch {
      setInlineResults([]);
      setInlineOpen(false);
    } finally {
      setInlineLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInlineResults(debouncedQuery);
  }, [debouncedQuery, fetchInlineResults]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const meDoc = usersSnap.docs.find((d) => d.id === user?.uid);
        const me = meDoc ? (meDoc.data() as any) : null;
        if (!me) {
          if (!ignore) setSuggestions([]);
          return;
        }
        const list: SuggestedMatch[] = [] as any;
        usersSnap.docs.forEach((d) => {
          if (d.id === user?.uid) return;
          const other = d.data() as any;
          let score = 0;
          const reasons: string[] = [];
          const myNames = (me.relativesNames ?? []).map((n: string) =>
            n.toLowerCase()
          );
          const otherNames = (other.relativesNames ?? []).map((n: string) =>
            n.toLowerCase()
          );
          const shared = myNames.filter((n: string) => otherNames.includes(n));
          if (shared.length) {
            score += Math.min(0.4, shared.length * 0.1);
            reasons.push(`Shared relatives: ${shared.slice(0, 3).join(", ")}`);
          }
          if (
            me.birthPlace &&
            other.birthPlace &&
            me.birthPlace.toLowerCase() === other.birthPlace.toLowerCase()
          ) {
            score += 0.25;
            reasons.push("Same birth place");
          }
          if (
            me.clanOrCulturalInfo &&
            other.clanOrCulturalInfo &&
            me.clanOrCulturalInfo.toLowerCase() ===
              other.clanOrCulturalInfo.toLowerCase()
          ) {
            score += 0.25;
            reasons.push("Matching clan/cultural info");
          }
          if (me.fullName && other.fullName) {
            const a = me.fullName.toLowerCase();
            const b = other.fullName.toLowerCase();
            if (a.includes(b) || b.includes(a)) {
              score += 0.1;
              reasons.push("Similar full name");
            }
          }
          if (score > 0)
            list.push({
              userId: d.id,
              fullName: other.fullName,
              score: Math.min(1, score),
              reasons,
            } as any);
        });
        list.sort((x: any, y: any) => y.score - x.score);
        if (!ignore) setSuggestions(list.slice(0, 9));
      } catch {
        if (!ignore) setSuggestions([]);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    let ignore = false;
    async function loadCounts() {
      if (!user) return;
      try {
        const reqsRef = collection(db, "connectionRequests");
        const q = query(
          reqsRef,
          where("toUserId", "==", user.uid),
          where("status", "==", "pending")
        );
        const snap = await getDocs(q);
        if (!ignore) setIncomingCount(snap.size);
      } catch {
        if (!ignore) setIncomingCount(0);
      }
    }
    loadCounts();
    return () => {
      ignore = true;
    };
  }, [user]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Welcome to Your Dashboard
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your personal space to explore your genetic story.
        </p>
      </div>

      {/* Family Code Generator for Approved Users */}
      {userProfile?.familyTreeApproved && (
        <div className="max-w-md">
          <FamilyCodeGenerator
            userProfile={userProfile}
            onCodeGenerated={(code) => {
              console.log("Family code generated:", code);
            }}
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="flex justify-center mb-8">
        <div className="relative w-full max-w-md mx-auto">
          <div className="flex border-2 border-primary overflow-hidden rounded-lg">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for relatives or family trees..."
              className="w-full outline-none bg-white text-gray-600 text-sm px-4 py-3"
              autoComplete="off"
              spellCheck={false}
              onFocus={() => inlineResults.length && setInlineOpen(true)}
            />
            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center justify-center bg-primary hover:bg-primary/90 px-5 text-sm text-white"
            >
              <Search className="h-4 w-4 mr-1" />
              Search
            </button>
          </div>
          {inlineOpen && (
            <div className="absolute z-20 mt-1 w-full bg-card border rounded-md shadow-lg overflow-hidden">
              {inlineLoading ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : inlineResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No results
                </div>
              ) : (
                <ul className="max-h-64 overflow-auto">
                  {inlineResults.map((r: any) => (
                    <li
                      key={r.id}
                      className="p-3 hover:bg-muted cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/dashboard/search?q=${encodeURIComponent(
                            searchQuery.trim()
                          )}`
                        )
                      }
                    >
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.location || r.birthPlace || ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {!analysisCompleted ? (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
              <Dna className="h-6 w-6" /> Start Your Discovery
            </CardTitle>
            <CardDescription>
              You haven't analyzed any DNA data yet. Upload your file to unlock
              your personalized reports and insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Image
                src="https://picsum.photos/300/200"
                width={300}
                height={200}
                alt="DNA Helix"
                data-ai-hint="dna abstract"
                className="rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="mb-4 text-foreground/80">
                  Supported formats include AncestryDNA, 23andMe, and
                  MyHeritage. Your data is encrypted and secure.
                </p>
                <Button asChild>
                  <Link href="/dashboard/dna-analysis">
                    Upload DNA File <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-1 lg:col-span-1">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary flex items-center gap-2">
                <Users /> Relative Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{relatives?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                potential relatives found.
              </p>
              <Button variant="link" className="px-0 mt-2" asChild>
                <Link href="/dashboard/relatives">
                  View Matches <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="col-span-1 lg:col-span-1">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary flex items-center gap-2">
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{incomingCount}</p>
              <p className="text-sm text-muted-foreground">
                pending connection requests
              </p>
              <Button variant="link" className="px-0 mt-2" asChild>
                <Link href="/dashboard/notifications">
                  Review Requests <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary flex items-center gap-2">
                <Globe /> Ancestry Composition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 line-clamp-2">
                {ancestryPreview}
              </p>
              <Button variant="link" className="px-0 mt-2" asChild>
                <Link href="/dashboard/ancestry">
                  Explore Your Origins <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {userProfile?.profileCompleted && (
        <div className="space-y-4">
          <div>
            <h2 className="font-headline text-2xl font-bold text-primary">
              AI Suggestions
            </h2>
            <p className="text-muted-foreground">
              People you might be connected to, based on your profile.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestions?.length ? (
              suggestions.map((s) => (
                <SuggestionCard key={s.userId} suggestion={s} />
              ))
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg text-primary">
                    No suggestions yet
                  </CardTitle>
                  <CardDescription>
                    Complete your profile and upload DNA to improve suggestions.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Suggested Family Trees - For Approved Users */}
      {userProfile?.familyTreeApproved && (
        <div className="space-y-4">
          <div>
            <h2 className="font-headline text-2xl font-bold text-primary">
              Suggested Family Trees
            </h2>
            <p className="text-muted-foreground">
              Discover interesting family trees you might want to explore.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg text-primary">
                  Explore Family Trees
                </CardTitle>
                <CardDescription>
                  Discover and connect with other family trees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/dashboard/family-tree">
                    View Family Trees <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Family Tree Discovery - For All Users */}
      <FamilyTreeSuggestions />

      <div className="grid gap-6 md:grid-cols-2">
        {features.map((feature) => (
          <Link href={feature.href} key={feature.title} className="group">
            <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-headline text-xl text-primary">
                      {feature.title}
                    </CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Link href="/dashboard/assistant" className="group md:col-span-2">
          <Card className="h-full transition-all bg-primary/5 group-hover:border-primary/50 group-hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl text-primary">
                    AI Genealogy Assistant
                  </CardTitle>
                  <CardDescription>
                    Have questions? Ask our AI assistant for help with your
                    research or understanding your results.
                  </CardDescription>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
