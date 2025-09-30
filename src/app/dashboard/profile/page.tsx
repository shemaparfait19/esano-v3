"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { saveUserDna, analyzeDna } from "@/app/actions";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    birthPlace: "",
    clanOrCulturalInfo: "",
    relativesNames: "",
  });
  const [loading, setLoading] = useState(true);

  // DNA upload state
  const [dnaFile, setDnaFile] = useState<File | null>(null);
  const [dnaSaving, setDnaSaving] = useState(false);
  const [dnaAnalyzing, setDnaAnalyzing] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && !ignore) {
        const d = snap.data() as any;
        setForm({
          fullName: d.fullName ?? "",
          birthDate: d.birthDate ?? "",
          birthPlace: d.birthPlace ?? "",
          clanOrCulturalInfo: d.clanOrCulturalInfo ?? "",
          relativesNames: (d.relativesNames ?? []).join(", "),
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  const onSave = async () => {
    if (!user) return;
    const relatives = form.relativesNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await setDoc(
      doc(db, "users", user.uid),
      {
        userId: user.uid,
        fullName: form.fullName || undefined,
        birthDate: form.birthDate || undefined,
        birthPlace: form.birthPlace || undefined,
        clanOrCulturalInfo: form.clanOrCulturalInfo || undefined,
        relativesNames: relatives,
        updatedAt: new Date().toISOString(),
        profileCompleted: true,
      },
      { merge: true }
    );
    toast({ title: "Profile updated" });
  };

  async function handleSaveDna() {
    if (!user || !dnaFile) {
      toast({
        title: "No file selected",
        description: "Choose a DNA file first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setDnaSaving(true);
      const text = await dnaFile.text();
      const res = await saveUserDna(user.uid, text, dnaFile.name);
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: res.error ?? "",
          variant: "destructive",
        });
      } else {
        toast({ title: "DNA saved", description: `Stored ${dnaFile.name}` });
      }
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setDnaSaving(false);
    }
  }

  async function handleAnalyzeDna() {
    if (!user || !dnaFile) {
      toast({
        title: "No file selected",
        description: "Choose a DNA file first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setDnaAnalyzing(true);
      const text = await dnaFile.text();
      await analyzeDna(user.uid, text, dnaFile.name);
      toast({
        title: "Analysis Complete",
        description: "Open Relatives/Ancestry/Insights to view results.",
      });
    } catch (e: any) {
      toast({
        title: "Analysis failed",
        description: e?.message ?? "Try again",
        variant: "destructive",
      });
    } finally {
      setDnaAnalyzing(false);
    }
  }

  if (loading) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Your Profile
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          View and update your personal and family information.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">
            Profile
          </CardTitle>
          <CardDescription>
            Keep your details up to date to improve AI suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Birth Date</label>
            <Input
              type="date"
              value={form.birthDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthDate: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Birth Place</label>
            <Input
              value={form.birthPlace}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthPlace: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Clan / Cultural Info</label>
            <Textarea
              value={form.clanOrCulturalInfo}
              onChange={(e) =>
                setForm((f) => ({ ...f, clanOrCulturalInfo: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">
              Known Relatives (comma separated)
            </label>
            <Input
              value={form.relativesNames}
              onChange={(e) =>
                setForm((f) => ({ ...f, relativesNames: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={onSave}>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">
            DNA Data
          </CardTitle>
          <CardDescription>
            Upload and save your raw DNA text file. You can analyze immediately
            or later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input
            type="file"
            onChange={(e) => setDnaFile(e.target.files?.[0] ?? null)}
          />
          {dnaFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {dnaFile.name} ({Math.round(dnaFile.size / 1024)} KB)
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSaveDna} disabled={!dnaFile || dnaSaving}>
              {dnaSaving ? "Saving..." : "Save DNA"}
            </Button>
            <Button
              variant="outline"
              onClick={handleAnalyzeDna}
              disabled={!dnaFile || dnaAnalyzing}
            >
              {dnaAnalyzing ? "Analyzing..." : "Analyze Now"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
