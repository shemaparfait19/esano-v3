"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type {
  FamilyTree,
  FamilyTreeEdge,
  FamilyTreeMember,
} from "@/types/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PageData = {
  id: string;
  title: string;
  subtitle?: string;
  photoUrl?: string;
  content: string[]; // paragraphs
};

function inferRelations(
  members: FamilyTreeMember[],
  edges: FamilyTreeEdge[],
  selfId?: string
) {
  // Build quick maps for basic relations to compute generations relative to self
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (e.relation === "parent") {
      parentsOf.set(e.toId, [...(parentsOf.get(e.toId) ?? []), e.fromId]);
      childrenOf.set(e.fromId, [...(childrenOf.get(e.fromId) ?? []), e.toId]);
    } else if (e.relation === "child") {
      parentsOf.set(e.fromId, [...(parentsOf.get(e.fromId) ?? []), e.toId]);
      childrenOf.set(e.toId, [...(childrenOf.get(e.toId) ?? []), e.fromId]);
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
      if (!ignore && snap.exists()) setTree(snap.data() as FamilyTree);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  const pages: PageData[] = useMemo(() => {
    if (!tree) return [];
    const members = tree.members;
    const edges = tree.edges;
    const relations = inferRelations(members, edges, user?.uid);
    const toPage = (m: FamilyTreeMember): PageData => {
      const isDeceased =
        m.isDeceased || (!!m.deathDate && m.deathDate.length > 0);
      const title = m.fullName;
      const subtitle =
        relations.get(m.id) ||
        (m.birthPlace ? `From ${m.birthPlace}` : undefined);
      const content: string[] = [];
      if (m.birthDate)
        content.push(
          `Born on ${new Date(m.birthDate).toDateString()}${
            m.birthPlace ? ` in ${m.birthPlace}` : ""
          }.`
        );
      if (isDeceased)
        content.push(
          `Deceased${
            m.deathDate ? ` on ${new Date(m.deathDate).toDateString()}` : ""
          }.`
        );
      if (m.occupation) content.push(`Occupation: ${m.occupation}.`);
      if (m.notes) content.push(m.notes);
      if (content.length === 0)
        content.push("No further details recorded yet.");
      return { id: m.id, title, subtitle, photoUrl: m.photoUrl, content };
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
                  {page?.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={page.title}
                      src={page.photoUrl}
                      className="w-full h-60 object-cover rounded-md border"
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
