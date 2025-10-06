"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { FamilyTree, FamilyEdge as AppEdge } from "@/types/family-tree";
import type { FamilyMember as AppMember } from "@/types/family-tree";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, BookOpen, Home } from "lucide-react";

type PageData = {
  id: string;
  title: string;
  subtitle?: string;
  media?: { url: string; type: "photo" | "video" };
  mediaList?: Array<{ url: string; type: "photo" | "video" }>;
  content: string[];
};

function inferRelations(
  members: AppMember[],
  edges: AppEdge[],
  selfId?: string
) {
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (e.type === "parent") {
      parentsOf.set(e.toId, [...(parentsOf.get(e.toId) ?? []), e.fromId]);
      childrenOf.set(e.fromId, [...(childrenOf.get(e.fromId) ?? []), e.toId]);
    }
  });
  const label = new Map<string, string>();
  if (selfId) {
    label.set(selfId, "You");
    const visited = new Set<string>([selfId]);
    const queue: { id: string; depth: number }[] = [{ id: selfId, depth: 0 }];
    while (queue.length) {
      const { id, depth } = queue.shift()!;
      const parents = parentsOf.get(id) ?? [];
      for (const p of parents) {
        if (!visited.has(p)) {
          visited.add(p);
          const d = depth - 1;
          label.set(
            p,
            d === -1
              ? "Parent"
              : d === -2
              ? "Grandparent"
              : d < -2
              ? `${Math.abs(d) - 1}x Great-Grandparent`
              : "Ancestor"
          );
          queue.push({ id: p, depth: d });
        }
      }
      const children = childrenOf.get(id) ?? [];
      for (const c of children) {
        if (!visited.has(c)) {
          visited.add(c);
          const d = depth + 1;
          label.set(
            c,
            d === 1
              ? "Child"
              : d === 2
              ? "Grandchild"
              : d > 2
              ? `${d - 1}x Great-Grandchild`
              : "Descendant"
          );
          queue.push({ id: c, depth: d });
        }
      }
    }
  }
  return label;
}

export default function AncestryBookPage() {
  const { user } = useAuth();
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [anim, setAnim] = useState<"none" | "next" | "prev">("none");
  const [featuredMedia, setFeaturedMedia] = useState<
    Map<string, { url: string; type: "photo" | "video" }>
  >(new Map());

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      const snap = await getDoc(doc(db, "familyTrees", user.uid));
      if (!ignore && snap.exists()) setTree(snap.data() as any as FamilyTree);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  const pages: PageData[] = useMemo(() => {
    if (!tree) return [];
    const members = tree.members as AppMember[];
    const edges = tree.edges as AppEdge[];
    const relations = inferRelations(members, edges, user?.uid);
    const toPage = (m: AppMember): PageData => {
      const isDeceased =
        m.isDeceased || (!!m.deathDate && m.deathDate.length > 0);
      const title = m.fullName;
      const origin =
        m.originRegion || (m.location ? `Lives in ${m.location}` : undefined);
      const subtitle = relations.get(m.id) || origin;
      const content: string[] = [];

      let media: PageData["media"] | undefined;
      const mediaList: Array<{ url: string; type: "photo" | "video" }> = [];
      const featured = (m as any)?.customFields?.featuredMediaUrl as
        | string
        | undefined;

      const userSelected = featuredMedia.get(m.id);
      if (userSelected) {
        media = userSelected;
      } else if (featured) {
        const t = featured.includes("video") ? "video" : "photo";
        media = { url: featured, type: t };
      } else if (m.avatarUrl) {
        media = { url: m.avatarUrl, type: "photo" };
      } else if (Array.isArray(m.timeline)) {
        const withUrl = m.timeline
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .find((t) => !!t.url);
        if (withUrl?.url) {
          const type = withUrl.type === "video" ? "video" : "photo";
          media = { url: withUrl.url, type };
        }
      }
      if (!media && Array.isArray(m.mediaUrls) && m.mediaUrls.length > 0) {
        const firstType = (
          m.mediaUrls[0].includes("video") ? "video" : "photo"
        ) as "photo" | "video";
        media = { url: m.mediaUrls[0], type: firstType };
      }

      const seen = new Set<string>();
      if (media) {
        mediaList.push(media);
        seen.add(media.url);
      }
      if (Array.isArray(m.timeline)) {
        m.timeline
          .filter((t) => !!t.url && !seen.has(t.url!))
          .slice(0, 5)
          .forEach((t) => {
            mediaList.push({
              url: t.url!,
              type: t.type === "video" ? "video" : "photo",
            });
            seen.add(t.url!);
          });
      }
      if (Array.isArray(m.mediaUrls)) {
        m.mediaUrls
          .filter((u) => !seen.has(u))
          .slice(0, 5)
          .forEach((u) => {
            mediaList.push({
              url: u,
              type: u.includes("video") ? "video" : "photo",
            });
            seen.add(u);
          });
      }

      if (m.birthDate)
        content.push(
          `Born on ${new Date(m.birthDate).toDateString()}${
            m.location ? ` in ${m.location}` : ""
          }.`
        );
      if (isDeceased)
        content.push(
          `Deceased${
            m.deathDate ? ` on ${new Date(m.deathDate).toDateString()}` : ""
          }.`
        );
      if (m.ethnicity) content.push(`Ethnicity: ${m.ethnicity}.`);
      if (Array.isArray(m.origins) && m.origins.length > 0)
        content.push(`Origins: ${m.origins.join(", ")}.`);
      if (Array.isArray(m.timeline) && m.timeline.length > 0)
        content.push(
          `Timeline entries: ${m.timeline
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 3)
            .map(
              (t) =>
                `${new Date(t.date).toLocaleDateString()} - ${
                  t.title || t.type
                }`
            )
            .join("; ")}.`
        );
      if (m.notes) content.push(m.notes);
      if (content.length === 0)
        content.push("No further details recorded yet.");

      return {
        id: m.id,
        title,
        subtitle,
        media,
        mediaList: mediaList.slice(0, 6),
        content,
      };
    };

    const scored = members.map((m) => ({
      m,
      score: relations.get(m.id)?.includes("Parent")
        ? 2
        : relations.get(m.id)?.includes("Grandparent")
        ? 1
        : 0,
    }));
    scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map((s) => s.m);

    const intro: PageData = {
      id: "intro",
      title: "Ancestry Journal",
      subtitle: "A family storybook",
      content: [
        "Turn the pages to explore detailed stories about your relatives.",
        "Entries are generated from your family tree data and will become richer as you add more details.",
      ],
    };
    return [intro, ...ordered.map(toPage)];
  }, [tree, user?.uid, featuredMedia]);

  function nextPage() {
    if (pageIndex < pages.length - 1) {
      setAnim("next");
      setTimeout(() => {
        setPageIndex((i) => i + 1);
        setAnim("none");
      }, 400);
    }
  }

  function prevPage() {
    if (pageIndex > 0) {
      setAnim("prev");
      setTimeout(() => {
        setPageIndex((i) => i - 1);
        setAnim("none");
      }, 400);
    }
  }

  function handleMediaClick(
    pageId: string,
    media: { url: string; type: "photo" | "video" }
  ) {
    setFeaturedMedia((prev) => {
      const newMap = new Map(prev);
      newMap.set(pageId, media);
      return newMap;
    });
  }

  function goToFirstPage() {
    setPageIndex(0);
  }

  const page = pages[pageIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 py-4 sm:py-8 px-2 sm:px-4 relative overflow-hidden">
      {/* Ambient background texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>

      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
            <h1 className="font-serif text-xl sm:text-3xl md:text-4xl font-bold text-amber-100 tracking-wide">
              Family Ancestry Book
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToFirstPage}
              className="text-amber-200 hover:text-amber-100 hover:bg-slate-700/50 text-xs sm:text-sm"
            >
              <Home className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Cover
            </Button>
            <div className="text-xs font-serif text-amber-200 bg-slate-700/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-slate-600">
              {pageIndex + 1} / {pages.length || 1}
            </div>
          </div>
        </div>

        {/* Book Container */}
        <div className="flex items-center justify-center relative">
          <div className="relative w-full">
            {/* Navigation Buttons - Desktop */}
            <Button
              variant="ghost"
              size="lg"
              onClick={prevPage}
              disabled={pageIndex === 0 || anim !== "none"}
              className="hidden lg:flex absolute -left-14 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-500 shadow-xl disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="h-6 w-6 text-amber-300" />
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={nextPage}
              disabled={pageIndex >= pages.length - 1 || anim !== "none"}
              className="hidden lg:flex absolute -right-14 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-500 shadow-xl disabled:opacity-20 transition-all"
            >
              <ChevronRight className="h-6 w-6 text-amber-300" />
            </Button>

            {/* Book */}
            <div className="relative" style={{ perspective: "2500px" }}>
              {/* Book shadow */}
              <div className="absolute inset-0 bg-black/40 blur-2xl translate-y-6 scale-95"></div>

              <Card
                className={`overflow-hidden shadow-2xl transition-all duration-400 ease-out relative
                  ${anim === "next" ? "animate-page-turn-next" : ""}
                  ${anim === "prev" ? "animate-page-turn-prev" : ""}
                `}
                style={{
                  background:
                    "linear-gradient(to right, #fef9e7 0%, #fef5e7 48%, #2c2c2c 48.5%, #1a1a1a 49.5%, #fef5e7 50%, #fef9e7 100%)",
                  transform:
                    anim === "next"
                      ? "rotateY(-8deg)"
                      : anim === "prev"
                      ? "rotateY(8deg)"
                      : "rotateY(0deg)",
                  borderRadius: "4px",
                  border: "2px solid #8b4513",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(139, 69, 19, 0.1)",
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[500px] sm:min-h-[600px] md:min-h-[650px]">
                  {/* Left Page */}
                  <div className="p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col gap-3 sm:gap-4 md:gap-5 bg-gradient-to-br from-amber-50/95 to-yellow-50/90 md:border-r-2 border-amber-900/20 relative">
                    {/* Page texture overlay */}
                    <div
                      className="absolute inset-0 opacity-5"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
                      }}
                    ></div>

                    <div className="space-y-1 sm:space-y-2 relative z-10">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-slate-800 leading-snug">
                        {page?.title || "Loading..."}
                      </h2>
                      {page?.subtitle && (
                        <p className="text-sm sm:text-base font-serif italic text-amber-700 border-l-2 border-amber-500 pl-2 sm:pl-3">
                          {page.subtitle}
                        </p>
                      )}
                    </div>

                    {page?.media?.url && page.media.type === "photo" && (
                      <div className="flex-1 flex items-center justify-center relative z-10">
                        <div className="relative w-full max-w-md">
                          <img
                            alt={page.title}
                            src={page.media.url}
                            className="w-full h-48 sm:h-56 md:h-72 object-cover rounded-sm shadow-lg border-2 sm:border-4 border-white/80"
                          />
                        </div>
                      </div>
                    )}

                    {page?.media?.url && page.media.type === "video" && (
                      <div className="flex-1 flex items-center justify-center relative z-10">
                        <video
                          src={page.media.url}
                          className="w-full max-w-md h-48 sm:h-56 md:h-72 rounded-sm shadow-lg border-2 sm:border-4 border-white/80"
                          controls
                        />
                      </div>
                    )}

                    {!page?.media?.url && (
                      <div className="flex-1 flex items-center justify-center relative z-10">
                        <div className="w-full max-w-md h-48 sm:h-56 md:h-72 bg-amber-100/60 rounded-sm border-2 sm:border-4 border-white/80 shadow-lg flex items-center justify-center">
                          <p className="text-amber-600/70 font-serif italic text-xs sm:text-sm">
                            No photo available
                          </p>
                        </div>
                      </div>
                    )}

                    {page?.mediaList && page.mediaList.length > 1 && (
                      <div className="mt-auto relative z-10">
                        <p className="text-[9px] sm:text-[10px] font-serif text-amber-700 mb-1.5 sm:mb-2 uppercase tracking-wide">
                          Gallery
                        </p>
                        <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                          {page.mediaList.map((m, i) => (
                            <button
                              key={i}
                              onClick={() => handleMediaClick(page.id, m)}
                              className="border-2 border-white rounded-sm overflow-hidden hover:border-amber-400 transition-all shadow hover:shadow-md transform hover:scale-110"
                              title={`View ${m.type}`}
                            >
                              {m.type === "photo" ? (
                                <img
                                  src={m.url}
                                  alt=""
                                  className="w-full h-10 sm:h-12 md:h-14 object-cover"
                                />
                              ) : (
                                <div className="w-full h-10 sm:h-12 md:h-14 bg-slate-700 text-white text-[8px] sm:text-[9px] flex items-center justify-center font-serif">
                                  ▶
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Page */}
                  <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-3 sm:space-y-4 md:space-y-5 bg-gradient-to-br from-yellow-50/90 to-amber-50/95 flex flex-col relative border-t md:border-t-0 border-amber-900/20">
                    {/* Page texture overlay */}
                    <div
                      className="absolute inset-0 opacity-5"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
                      }}
                    ></div>

                    <div className="flex-1 space-y-3 sm:space-y-4 relative z-10">
                      {(page?.content ?? []).map((p, idx) => (
                        <p
                          key={idx}
                          className="font-serif text-xs sm:text-sm leading-relaxed text-slate-800/95 indent-4 sm:indent-6"
                        >
                          {p}
                        </p>
                      ))}
                    </div>

                    {/* Page number */}
                    <div className="text-center text-xs font-serif text-amber-700/70 pt-3 sm:pt-4 border-t border-amber-300/30 relative z-10">
                      {pageIndex + 1}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Book spine effect - hidden on mobile */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-r from-amber-900/60 via-amber-950/80 to-amber-900/60 -translate-x-1/2 pointer-events-none shadow-lg"></div>
            </div>

            {/* Mobile Navigation Buttons */}
            <div className="flex lg:hidden justify-between mt-4 gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={prevPage}
                disabled={pageIndex === 0 || anim !== "none"}
                className="flex-1 h-12 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 shadow-xl disabled:opacity-20 transition-all"
              >
                <ChevronLeft className="h-5 w-5 text-amber-300 mr-2" />
                <span className="text-amber-300 text-sm">Previous</span>
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={nextPage}
                disabled={pageIndex >= pages.length - 1 || anim !== "none"}
                className="flex-1 h-12 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 shadow-xl disabled:opacity-20 transition-all"
              >
                <span className="text-amber-300 text-sm">Next</span>
                <ChevronRight className="h-5 w-5 text-amber-300 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {pages.length === 0 && (
          <div className="text-center px-2">
            <Card className="max-w-2xl mx-auto p-6 sm:p-10 bg-amber-50 border-2 border-amber-800/30 shadow-xl">
              <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 text-amber-700/50 mx-auto mb-3 sm:mb-4" />
              <p className="font-serif text-base sm:text-lg text-amber-800 leading-relaxed">
                Your ancestry book awaits its first story. Add relatives in your
                family tree to begin writing your family's legacy.
              </p>
            </Card>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes page-turn-next {
          0% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(-8deg);
          }
          100% {
            transform: rotateY(0deg);
          }
        }
        @keyframes page-turn-prev {
          0% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(8deg);
          }
          100% {
            transform: rotateY(0deg);
          }
        }
      `}</style>
    </div>
  );
}
