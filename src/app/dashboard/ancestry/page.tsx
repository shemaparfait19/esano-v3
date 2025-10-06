"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { FamilyTree, FamilyEdge as AppEdge } from "@/types/family-tree";
import type { FamilyMember as AppMember } from "@/types/family-tree";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

      // Check if user has selected custom featured media
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

      // Build media list
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
        "Entries are generated from your Family Tree data and will become richer as you add more details.",
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

  const page = pages[pageIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-4xl font-bold text-amber-900 md:text-5xl tracking-tight">
            Family Ancestry Book
          </h1>
          <div className="text-sm font-serif text-amber-800 bg-amber-100 px-4 py-2 rounded-full border border-amber-300">
            Page {pageIndex + 1} of {pages.length || 1}
          </div>
        </div>

        <div className="flex items-center justify-center relative">
          <div className="relative w-full max-w-6xl">
            <Button
              variant="ghost"
              size="lg"
              onClick={prevPage}
              disabled={pageIndex === 0 || anim !== "none"}
              className="absolute -left-16 top-1/2 -translate-y-1/2 z-20 h-16 w-16 rounded-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-300 shadow-lg disabled:opacity-30"
            >
              <ChevronLeft className="h-8 w-8 text-amber-900" />
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={nextPage}
              disabled={pageIndex >= pages.length - 1 || anim !== "none"}
              className="absolute -right-16 top-1/2 -translate-y-1/2 z-20 h-16 w-16 rounded-full bg-amber-100 hover:bg-amber-200 border-2 border-amber-300 shadow-lg disabled:opacity-30"
            >
              <ChevronRight className="h-8 w-8 text-amber-900" />
            </Button>

            <div className="relative" style={{ perspective: "2000px" }}>
              <Card
                className={`overflow-hidden shadow-2xl border-4 border-amber-900/20 transition-all duration-400 ease-out
                  ${anim === "next" ? "animate-page-turn-next" : ""}
                  ${anim === "prev" ? "animate-page-turn-prev" : ""}
                `}
                style={{
                  background:
                    "linear-gradient(to bottom right, #fefce8, #fef3c7, #fde68a)",
                  transform:
                    anim === "next"
                      ? "rotateY(-15deg)"
                      : anim === "prev"
                      ? "rotateY(15deg)"
                      : "rotateY(0deg)",
                }}
              >
                <div className="grid md:grid-cols-2 gap-0 min-h-[600px]">
                  {/* Left page - Media */}
                  <div className="p-10 flex flex-col gap-6 bg-gradient-to-br from-amber-50/50 to-orange-50/30 border-r-2 border-amber-900/10">
                    <div className="space-y-3">
                      <h2 className="text-4xl font-serif font-bold text-amber-900 leading-tight">
                        {page?.title || "Loading..."}
                      </h2>
                      {page?.subtitle && (
                        <p className="text-lg font-serif italic text-amber-700 border-l-4 border-amber-400 pl-4">
                          {page.subtitle}
                        </p>
                      )}
                    </div>

                    {page?.media?.url && page.media.type === "photo" && (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="relative w-full max-w-md">
                          <div className="absolute inset-0 bg-amber-900/5 rotate-1"></div>
                          <img
                            alt={page.title}
                            src={page.media.url}
                            className="relative w-full h-80 object-cover rounded shadow-xl border-8 border-white"
                          />
                        </div>
                      </div>
                    )}

                    {page?.media?.url && page.media.type === "video" && (
                      <div className="flex-1 flex items-center justify-center">
                        <video
                          src={page.media.url}
                          className="w-full max-w-md h-80 rounded shadow-xl border-8 border-white"
                          controls
                        />
                      </div>
                    )}

                    {!page?.media?.url && (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="w-full max-w-md h-80 bg-amber-100/50 rounded border-8 border-white shadow-xl flex items-center justify-center">
                          <p className="text-amber-600 font-serif italic">
                            No photo available
                          </p>
                        </div>
                      </div>
                    )}

                    {page?.mediaList && page.mediaList.length > 1 && (
                      <div className="mt-auto">
                        <p className="text-xs font-serif text-amber-700 mb-2 uppercase tracking-wider">
                          Photo Gallery
                        </p>
                        <div className="grid grid-cols-6 gap-2">
                          {page.mediaList.map((m, i) => (
                            <button
                              key={i}
                              onClick={() => handleMediaClick(page.id, m)}
                              className="border-4 border-white rounded overflow-hidden hover:border-amber-400 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                              title={`Click to view ${m.type}`}
                            >
                              {m.type === "photo" ? (
                                <img
                                  src={m.url}
                                  alt=""
                                  className="w-full h-16 object-cover"
                                />
                              ) : (
                                <div className="w-full h-16 bg-amber-900 text-white text-[10px] flex items-center justify-center font-serif">
                                  ▶ Video
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right page - Text content */}
                  <div className="p-10 space-y-6 bg-gradient-to-br from-orange-50/30 to-amber-50/50 flex flex-col">
                    <div className="flex-1 space-y-5">
                      {(page?.content ?? []).map((p, idx) => (
                        <p
                          key={idx}
                          className="font-serif text-base leading-relaxed text-amber-950/90 first-letter:text-5xl first-letter:font-bold first-letter:text-amber-900 first-letter:float-left first-letter:mr-2 first-letter:mt-1"
                        >
                          {p}
                        </p>
                      ))}
                    </div>

                    {/* Decorative page number */}
                    <div className="text-center text-sm font-serif text-amber-600 pt-4 border-t border-amber-300/50">
                      ~ {pageIndex + 1} ~
                    </div>
                  </div>
                </div>
              </Card>

              {/* Book spine shadow effect */}
              <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-gradient-to-r from-amber-900/20 via-amber-900/10 to-transparent -translate-x-1/2 pointer-events-none"></div>
            </div>
          </div>
        </div>

        {pages.length === 0 && (
          <div className="text-center">
            <Card className="max-w-2xl mx-auto p-12 bg-amber-50 border-4 border-amber-300">
              <p className="font-serif text-xl text-amber-800 leading-relaxed">
                Your ancestry book awaits its first story. Add relatives in your
                Family Tree to begin writing your family's legacy.
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
            transform: rotateY(-15deg);
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
            transform: rotateY(15deg);
          }
          100% {
            transform: rotateY(0deg);
          }
        }
      `}</style>
    </div>
  );
}
