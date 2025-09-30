// @ts-nocheck
"use client";
import type { SuggestedMatch } from "@/app/actions";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import React, { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = { suggestion: SuggestedMatch };

export function SuggestionCard({ suggestion }: Props) {
  const fallback = (suggestion.fullName ?? suggestion.userId)
    .substring(0, 2)
    .toUpperCase();
  const percent = Math.round(suggestion.score * 100);
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [requested, setRequested] = useState(false);

  const onRequest = () => {
    if (!user) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromUserId: user.uid,
            toUserId: suggestion.userId,
          }),
        });
        if (!res.ok) {
          // fallback to direct write if API blocked
          const id = `${user.uid}_${suggestion.userId}`;
          await setDoc(
            doc(db, "connectionRequests", id),
            {
              fromUserId: user.uid,
              toUserId: suggestion.userId,
              status: "pending",
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
        setRequested(true);
        toast({ title: "Request sent" });
      } catch {}
    });
  };

  const onViewProfile = () => {
    router.push(`/dashboard/profile/${suggestion.userId}`);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage
            src={`https://picsum.photos/seed/${suggestion.userId}/100`}
            data-ai-hint="person face"
          />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="font-headline text-lg">
            Suggested Connection
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {suggestion.fullName ?? `User ${suggestion.userId}`}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Confidence {percent}%</Badge>
          {suggestion.reasons.slice(0, 3).map((r, idx) => (
            <Badge key={idx} variant="outline">
              {r}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="w-full"
          onClick={onRequest}
          disabled={isPending || requested}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {requested ? "Requested" : "Request Connection"}
        </Button>
        <Button className="w-full" variant="outline" onClick={onViewProfile}>
          View Profile
        </Button>
      </CardFooter>
    </Card>
  );
}
