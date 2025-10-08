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
import { Dna, Search, Loader2 } from "lucide-react";

type Match = {
  userId: string;
  fileName: string;
  relationship: string;
  confidence: number;
  details?: string;
};

export function DnaMatchFinder({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [dnaTextInput, setDnaTextInput] = useState("");
  const [diag, setDiag] = useState<any | null>(null);

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
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      // Persist matches to profile so Relatives page shows them
      try {
        await fetch("/api/dna/save-matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            matches: Array.isArray(data.matches) ? data.matches : [],
          }),
        });
      } catch {}
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
                <div>
                  <div className="font-medium">
                    {m.relationship} • {Math.round(m.confidence)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    userId: {m.userId} • {m.fileName}
                  </div>
                  {m.details && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {m.details}
                    </div>
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
