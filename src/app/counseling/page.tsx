"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type TopicKey = "calm" | "fairFighting" | "peacefulResolution" | "starSystem";

export default function CounselingPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<TopicKey>("calm");

  const topics: {
    key: TopicKey;
    title: string;
    icon: React.ReactNode;
    summary: string;
  }[] = [
    {
      key: "calm",
      title: "12 Steps to Calm Down",
      icon: <Brain className="h-4 w-4" />,
      summary:
        "A practical roadmap for recognizing triggers and de-escalating anger.",
    },
    {
      key: "fairFighting",
      title: "Rules for Fair Fighting",
      icon: <HeartHandshake className="h-4 w-4" />,
      summary: "Guidelines to argue productively without hurting one another.",
    },
    {
      key: "peacefulResolution",
      title: "Peaceful Conflict Resolution (RESOLUTION)",
      icon: <BookOpen className="h-4 w-4" />,
      summary:
        "A mnemonic to resolve conflicts respectfully and cooperatively.",
    },
    {
      key: "starSystem",
      title: "The STAR System",
      icon: <Sparkles className="h-4 w-4" />,
      summary: "Stop – Think – Act – Reward: a quick self-control loop.",
    },
  ];

  const filteredTopics = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)
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
                    key={t.key}
                    onClick={() => setActive(t.key)}
                    className={
                      "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors " +
                      (active === t.key
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted")
                    }
                    aria-current={active === t.key ? "page" : undefined}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">{t.icon}</span>
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
          {active === "calm" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">12 Steps to Calm Down</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 leading-relaxed">
                <p>
                  When you’re angry, use these steps to recognize triggers,
                  interrupt the cycle, and channel the energy productively.
                </p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    <strong>Maintain a “Hostility Log”</strong> — Track triggers
                    and frequency. Awareness enables better strategies. Consider
                    a simple daily note.
                  </li>
                  <li>
                    <strong>Acknowledge the problem</strong> — You cannot change
                    what you don’t acknowledge. Acceptance is the start of
                    progress.
                  </li>
                  <li>
                    <strong>Use your support network</strong> — Share your goals
                    with people who can encourage you when old habits reappear.
                  </li>
                  <li>
                    <strong>Interrupt the anger cycle</strong> — Try S.T.A.R.:
                    Slow deep breaths; Tell yourself you can handle this; And{" "}
                    <em>replace</em> negative thoughts; Reset.
                  </li>
                  <li>
                    <strong>Use empathy</strong> — See the situation from the
                    other person’s view. Everyone makes mistakes; learning
                    follows.
                  </li>
                  <li>
                    <strong>Laugh at yourself</strong> — Lighten the moment.
                    Humor reduces tension and reframes perspective.
                  </li>
                  <li>
                    <strong>Relax</strong> — Let small things stay small. Build
                    simple calm routines.
                  </li>
                  <li>
                    <strong>Build trust</strong> — Assume goodwill first.
                    Cynicism fuels anger; trust loosens it.
                  </li>
                  <li>
                    <strong>Listen</strong> — Better listening reduces
                    miscommunication and prevents escalation.
                  </li>
                  <li>
                    <strong>Be assertive (not aggressive)</strong> — State
                    expectations and boundaries clearly, without attacking.
                  </li>
                  <li>
                    <strong>Live each day fully</strong> — Time is limited;
                    invest it in what brings peace and growth.
                  </li>
                  <li>
                    <strong>Forgive</strong> — Let go of resentments to move
                    forward. Seek professional help if needed.
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}

          {active === "fairFighting" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Rules for Fair Fighting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 leading-relaxed">
                <p>
                  Productive conflict is possible. These principles help you
                  protect the relationship while solving the issue.
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Don’t overreact to small things.</li>
                  <li>No “below the belt” remarks meant to wound.</li>
                  <li>Avoid guilt trips or shaming; never seek to harm.</li>
                  <li>Don’t use silence or withdrawal of love as tactics.</li>
                  <li>Don’t act cold or distant to punish.</li>
                  <li>Focus on your feelings; avoid personal attacks.</li>
                  <li>Avoid assuming the other’s motives.</li>
                  <li>Keep it specific and concrete.</li>
                  <li>Don’t threaten to leave during fights.</li>
                  <li>Debate the issue, not each other’s worth.</li>
                  <li>Pause when overheated; schedule a time to resume.</li>
                  <li>No blaming spirals.</li>
                  <li>Speak calmly and briefly; don’t overwhelm.</li>
                  <li>Let go of old hurts; don’t recycle past fights.</li>
                  <li>Avoid being “addicted to being right.”</li>
                  <li>
                    Don’t try to defeat your partner; aim for mutual okayness.
                  </li>
                  <li>No warnings of violence. No violence.</li>
                </ul>
              </CardContent>
            </Card>
          )}

          {active === "peacefulResolution" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Peaceful Conflict Resolution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 leading-relaxed">
                <p className="text-sm text-muted-foreground">RESOLUTION</p>
                <Separator />
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <li>
                    <strong>R</strong> — Respect your right to disagree
                  </li>
                  <li>
                    <strong>E</strong> — Express your real concerns
                  </li>
                  <li>
                    <strong>S</strong> — Share common goals and interests
                  </li>
                  <li>
                    <strong>O</strong> — Open yourself to different points of
                    view
                  </li>
                  <li>
                    <strong>L</strong> — Listen carefully to all proposals
                  </li>
                  <li>
                    <strong>U</strong> — Understand the issues involved
                  </li>
                  <li>
                    <strong>T</strong> — Think about probable consequences
                  </li>
                  <li>
                    <strong>I</strong> — Imagine alternative solutions
                  </li>
                  <li>
                    <strong>O</strong> — Offer reasonable compromises
                  </li>
                  <li>
                    <strong>N</strong> — Negotiate fair, cooperative agreements
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          {active === "starSystem" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">The STAR System</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 leading-relaxed">
                <p>
                  <strong>Stop – Think – Act – Reward</strong>
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <strong>S = Stop</strong> — Pause the automatic reactions.
                    Don’t yell, get defensive, or bottle feelings.
                  </li>
                  <li>
                    <strong>T = Think</strong> — What do I need right now? Anger
                    is okay; use it to solve the problem.
                  </li>
                  <li>
                    <strong>A = Act</strong> — Take the constructive step:
                    self-talk and plan; if others are involved, speak about
                    solutions.
                  </li>
                  <li>
                    <strong>R = Reward</strong> — Acknowledge the effort you
                    made to choose a better response. Reinforce the habit.
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
