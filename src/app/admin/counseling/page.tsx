"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Save, Trash2, RefreshCcw } from "lucide-react";

type Topic = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  imageUrl?: string;
  content: string;
  isPublished: boolean;
  order: number;
};

export default function AdminCounselingPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return !q
      ? topics
      : topics.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.summary.toLowerCase().includes(q) ||
            (t.slug || "").toLowerCase().includes(q)
        );
  }, [topics, query]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/counseling/topics");
      const data = await res.json();
      if (data.success) setTopics(data.topics || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () =>
    setEditing({
      title: "",
      slug: "",
      summary: "",
      imageUrl: "",
      content: "",
      isPublished: true,
      order: topics.length,
    });

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing } as any;
    delete payload.id;
    const isUpdate = Boolean(editing.id);
    const url = isUpdate
      ? `/api/admin/counseling/topics/${editing.id}`
      : "/api/admin/counseling/topics";
    const method = isUpdate ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this topic?")) return;
    await fetch(`/api/admin/counseling/topics/${id}`, { method: "DELETE" });
    if (editing?.id === id) setEditing(null);
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Counseling Topics</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56"
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> New Topic
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Topics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.summary}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(t.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No topics found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? (editing.id ? "Edit Topic" : "New Topic") : "Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Summary</Label>
                  <Textarea
                    value={editing.summary}
                    onChange={(e) =>
                      setEditing({ ...editing, summary: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Image URL</Label>
                  <Input
                    value={editing.imageUrl || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, imageUrl: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Content</Label>
                  <RichTextEditor
                    value={editing.content}
                    onChange={(html) =>
                      setEditing({ ...editing, content: html })
                    }
                    minHeightClass="min-h-[280px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      value={editing.order}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          order: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={editing.isPublished}
                      onCheckedChange={(v) =>
                        setEditing({ ...editing, isPublished: v })
                      }
                    />
                    <span className="text-sm">Published</span>
                  </div>
                </div>

                <Separator />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button onClick={save}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a topic to edit or create a new one.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
