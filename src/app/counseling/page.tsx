"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  Search,
  BookOpen,
  HeartHandshake,
  Brain,
  Sparkles,
} from "lucide-react";

type Topic = {
  id: string;
  title: string;
  slug?: string;
  summary: string;
  imageUrl?: string;
  content?: string;
};

export default function CounselingPage() {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/counseling/topics");
        const data = await res.json();
        if (data.success) {
          setTopics(data.topics || []);
          if (!activeId && data.topics?.length) setActiveId(data.topics[0].id);
        }
      } catch {}
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTopics = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || (t.summary || "").toLowerCase().includes(q)
    );
  }, [query, topics]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← Back to Home
          </Link>
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, e.g. anger, resolve, trust..."
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="container py-8 md:py-10 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Counseling Topics</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="flex flex-col">
                {filteredTopics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={
                      "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors " +
                      (activeId === t.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted")
                    }
                    aria-current={activeId === t.id ? "page" : undefined}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground"><BookOpen className="h-4 w-4" /></span>
                      <span>{t.title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">How to use this</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Pick a topic. Read slowly. Try the steps. Revisit when needed.
              </p>
              <p>
                These tools are not a substitute for professional care when
                required.
              </p>
            </CardContent>
          </Card>
        </aside>

        {/* Content */}
        <section className="space-y-6">
          {activeId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{topics.find((t) => t.id === activeId)?.title || "Topic"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 leading-relaxed">
                {(() => {
                  const topic = topics.find((t) => t.id === activeId);
                  if (!topic) return null;
                  return (
                    <>
                      {topic.imageUrl && (
                        <img
                          src={topic.imageUrl}
                          alt="Topic"
                          className="w-full max-h-64 object-cover rounded-md"
                        />
                      )}
                      {topic.content ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {/* eslint-disable-next-line react/no-danger */}
                          <div dangerouslySetInnerHTML={{ __html: topic.content }} />
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No content available yet.</p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
          )}
        </section>
      </main>
    </div>
  );
}
