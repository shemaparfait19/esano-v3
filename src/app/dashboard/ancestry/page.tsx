"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { FamilyTree, FamilyEdge as AppEdge } from "@/types/family-tree";
import type { FamilyMember as AppMember } from "@/types/family-tree";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PageData = {
  id: string;
  title: string;
  subtitle?: string;
  media?: { url: string; type: "photo" | "video" };
  content: string[]; // paragraphs
};

function inferRelations(
  members: AppMember[],
  edges: AppEdge[],
  selfId?: string
) {
  // Build quick maps for basic relations to compute generations relative to self
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
      // Select featured media
      let media: PageData["media"] | undefined;
      const featured = (m as any)?.customFields?.featuredMediaUrl as
        | string
        | undefined;
      if (featured) {
        media = {
          url: featured,
          type: featured.includes("video") ? "video" : "photo",
        };
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
        media = {
          url: m.mediaUrls[0],
          type: (m.mediaUrls[0].includes("video") ? "video" : "photo") as any,
        };
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
      return { id: m.id, title, subtitle, media, content };
    };
    // Simple order: ancestors first (parents/grandparents), then others
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
    // Intro page
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
  }, [tree, user?.uid]);

  function nextPage() {
    if (pageIndex < pages.length - 1) {
      setAnim("next");
      setTimeout(() => {
        setPageIndex((i) => i + 1);
        setAnim("none");
      }, 180);
    }
  }
  function prevPage() {
    if (pageIndex > 0) {
      setAnim("prev");
      setTimeout(() => {
        setPageIndex((i) => i - 1);
        setAnim("none");
      }, 180);
    }
  }

  const page = pages[pageIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Ancestry
        </h1>
        <div className="text-sm text-muted-foreground">
          Page {pageIndex + 1} / {pages.length || 1}
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-full max-w-4xl">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={prevPage}
              disabled={pageIndex === 0}
            >
              {"<"}
            </Button>
          </div>
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={nextPage}
              disabled={pageIndex >= pages.length - 1}
            >
              {">"}
            </Button>
          </div>

          <div className="perspective-[1200px]">
            <Card
              className={`overflow-hidden shadow-2xl bg-card/95 transition-transform duration-200 ${
                anim === "next"
                  ? "-rotate-y-6"
                  : anim === "prev"
                  ? "rotate-y-6"
                  : ""
              }`}
            >
              <div className="grid md:grid-cols-2 gap-0">
                <div className="p-6 flex flex-col gap-4 bg-primary/5">
                  <div className="text-2xl font-headline text-primary">
                    {page?.title || "Loading..."}
                  </div>
                  {page?.subtitle && (
                    <div className="text-sm text-muted-foreground">
                      {page.subtitle}
                    </div>
                  )}
                  {page?.media?.url && page.media.type === "photo" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={page.title}
                      src={page.media.url}
                      className="w-full h-60 object-cover rounded-md border"
                    />
                  )}
                  {page?.media?.url && page.media.type === "video" && (
                    <video
                      src={page.media.url}
                      className="w-full h-60 rounded-md border"
                      controls
                    />
                  )}
                </div>
                <div className="p-6 space-y-4">
                  {(page?.content ?? []).map((p, idx) => (
                    <p key={idx} className="leading-relaxed text-foreground/90">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {pages.length === 0 && (
        <div className="text-center text-muted-foreground">
          No ancestry data yet. Add relatives in your Family Tree to populate
          this journal.
        </div>
      )}
    </div>
  );
}
