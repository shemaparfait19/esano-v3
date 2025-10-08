// @ts-nocheck
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Dna, Search, Loader2 } from "lucide-react";

type Match = {
  userId: string;
  fileName: string;
  relationship: string;
  confidence: number;
  details?: string;
  displayName?: string;
  avatarUrl?: string;
};

export function DnaMatchFinder({ userId }: { userId: string }) {
  const { toast } = useToast();
  const { user } = useAuth() as any;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [dnaTextInput, setDnaTextInput] = useState("");
  const [diag, setDiag] = useState<any | null>(null);
  const [statusByUser, setStatusByUser] = useState<
    Record<string, { requested: boolean; connected: boolean }>
  >({});

  const onFind = async () => {
    const hasText = dnaTextInput && dnaTextInput.trim().length > 0;
    if (!hasText && !file) {
      toast({
        title: "Provide DNA data",
        description: "Paste DNA text or choose a file.",
        variant: "destructive",
      });
      return;
    }
    if (!hasText && file && file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max 10 MB.",
        variant: "destructive",
      });
      return;
    }
    try {
      setLoading(true);
      const dnaText = hasText
        ? dnaTextInput.slice(0, 1_000_000)
        : (await file!.text()).slice(0, 1_000_000);
      const resp = await fetch("/api/dna/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, dnaText }),
      });
      const data = await resp.json();
      setDiag(data?._diag || null);
      if (!resp.ok) throw new Error(data?.error || "Match failed");
      const list = Array.isArray(data.matches) ? data.matches : [];
      setMatches(list);
      updateStatuses(list.map((m: any) => m.userId));
      // Do not persist matches automatically; keep results on this page only
      if (!data.matches || data.matches.length === 0) {
        toast({
          title: "No matches found",
          description:
            "You can save your DNA on your Profile so others can match later.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Match failed",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatuses = async (uids: string[]) => {
    if (!user?.uid || uids.length === 0) return;
    try {
      const reqRef = collection(db, "connectionRequests");
      const conRef = collection(db, "connections");
      const [outgoing, acceptedA, acceptedB] = await Promise.all([
        getDocs(query(reqRef, where("fromUserId", "==", user.uid))),
        getDocs(
          query(
            conRef,
            where("participants", "array-contains", user.uid),
            where("status", "==", "connected")
          )
        ),
        getDocs(
          query(
            conRef,
            where("participants", "array-contains", user.uid),
            where("status", "==", "accepted")
          )
        ),
      ]);
      const reqSet = new Set<string>();
      outgoing.docs.forEach((d) =>
        reqSet.add((d.data() as any)?.toUserId || "")
      );
      const conSet = new Set<string>();
      [...acceptedA.docs, ...acceptedB.docs].forEach((d: any) => {
        const arr = (d.data() as any)?.participants || [];
        if (Array.isArray(arr))
          arr.forEach((id: string) => {
            if (id !== user.uid) conSet.add(id);
          });
      });
      const next: Record<string, { requested: boolean; connected: boolean }> =
        {};
      for (const id of uids)
        next[id] = { requested: reqSet.has(id), connected: conSet.has(id) };
      setStatusByUser(next);
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
          <Dna className="h-6 w-6" /> Find Matches
        </CardTitle>
        <CardDescription>
          Upload a DNA file to compare against saved DNA in the system. Max 10
          MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button onClick={onFind} disabled={loading} className="sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" /> Find Matches
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">
              Or paste DNA text (VCF or raw export)
            </label>
            <textarea
              value={dnaTextInput}
              onChange={(e) => setDnaTextInput(e.target.value)}
              rows={6}
              className="w-full rounded border p-2 font-mono text-sm"
              placeholder="#CHROM POS ID REF ALT ... or raw letters"
            />
            <div className="text-xs text-muted-foreground">
              We’ll use pasted text if provided; otherwise your selected file.
              Max 1,000,000 characters.
            </div>
          </div>
        </div>

        {diag && (
          <div className="rounded border p-3 text-xs text-muted-foreground space-y-1">
            <div>
              Seen SNPs: {diag.userSnps} | Candidates: {diag.candidatesCount}
            </div>
            {Array.isArray(diag.sampleCandidates) &&
              diag.sampleCandidates.length > 0 && (
                <div>
                  Samples:
                  <ul className="list-disc ml-4">
                    {diag.sampleCandidates.map((c: any, i: number) => (
                      <li key={i}>
                        {c.userId} • {c.fileName} • len {c.textLen}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}

        {matches.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            {matches.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border p-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={
                      m.avatarUrl || `https://picsum.photos/seed/${m.userId}/64`
                    }
                    alt="avatar"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="font-medium">
                    {m.displayName || m.userId} • {m.relationship} •{" "}
                    {Math.round(m.confidence)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.fileName}
                  </div>
                  {m.details && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {m.details}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      router.push(
                        `/dashboard/profile/${encodeURIComponent(m.userId)}`
                      )
                    }
                  >
                    View Profile
                  </Button>
                  {statusByUser[m.userId]?.connected ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/dashboard/messages?peer=${encodeURIComponent(
                            m.userId
                          )}`
                        )
                      }
                    >
                      Message
                    </Button>
                  ) : statusByUser[m.userId]?.requested ? (
                    <Button size="sm" disabled>
                      Requested
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!user?.uid) {
                          toast({
                            title: "Sign in required",
                            variant: "destructive",
                          });
                          return;
                        }
                        try {
                          const res = await fetch("/api/requests", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fromUserId: user.uid,
                              toUserId: m.userId,
                            }),
                          });
                          if (res.ok) {
                            toast({ title: "Request sent" });
                            updateStatuses([m.userId]);
                          } else {
                            toast({
                              title: "Failed to send request",
                              variant: "destructive",
                            });
                          }
                        } catch {
                          toast({
                            title: "Failed to send request",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
