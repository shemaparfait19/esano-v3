"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
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
import { Dna, Trash2, UploadCloud } from "lucide-react";

type DnaItem = {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  fileSize: number;
  status: string;
};

export function DnaProfileManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<DnaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const resp = await fetch("/api/dna", { cache: "no-store" });
      const data = await resp.json();
      setItems(
        Array.isArray(data.items)
          ? data.items.filter((i: DnaItem) => i.userId === user?.uid)
          : []
      );
    } catch (e: any) {
      toast({
        title: "Failed to load DNA files",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function onUpload() {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please sign in first.",
        variant: "destructive",
      });
      return;
    }
    if (!file) {
      toast({
        title: "No file selected",
        description: "Choose a DNA file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max 10 MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("userId", user.uid);
      fd.set("file", file);
      const resp = await fetch("/api/dna/upload", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      toast({ title: "DNA file saved", description: data.fileName });
      setFile(null);
      await refresh();
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(item: DnaItem) {
    if (!confirm(`Remove ${item.fileName}?`)) return;
    try {
      const resp = await fetch(
        `/api/dna?userId=${encodeURIComponent(
          item.userId
        )}&fileName=${encodeURIComponent(item.fileName)}`,
        { method: "DELETE" }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Delete failed");
      toast({ title: "DNA file removed" });
      await refresh();
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
          <Dna className="h-6 w-6" /> Manage DNA Data
        </CardTitle>
        <CardDescription>
          Upload raw exports (txt/csv). Max 10 MB. You can remove them anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            onClick={onUpload}
            disabled={!file || uploading}
            className="sm:w-auto"
          >
            <UploadCloud className="mr-2 h-4 w-4" />{" "}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        <div className="border-t pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No DNA file saved yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <a
                      href={it.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {it.fileName}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      Uploaded {new Date(it.uploadDate).toLocaleString()} •{" "}
                      {Math.round(it.fileSize / 1024)} KB
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(it)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
