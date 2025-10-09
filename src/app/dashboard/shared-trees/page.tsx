"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ShareItem = {
  id: string;
  ownerId: string;
  role: "viewer" | "editor";
  targetUserId: string;
  targetEmail: string;
};

export default function SharedTreesPage() {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/family-tree/share?sharedWithMe=1&userId=${user.uid}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load shares");
        if (!ignore) setShares((data.shares || []) as ShareItem[]);
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Failed to load");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading shared trees...
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Trees shared with me</h2>
      {shares.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No shared trees yet.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shares.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <div className="font-medium">Owner: {s.ownerId}</div>
                <div className="text-xs text-muted-foreground">
                  Role: {s.role}
                </div>
              </div>
              <Button asChild variant="secondary">
                <a
                  href={`/dashboard/family-tree?ownerId=${encodeURIComponent(
                    s.ownerId
                  )}`}
                >
                  Open
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
