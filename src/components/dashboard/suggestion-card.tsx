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
import React, { useTransition } from "react";
import { Loader2 } from "lucide-react";

type Props = { suggestion: SuggestedMatch };

export function SuggestionCard({ suggestion }: Props) {
  const fallback = (suggestion.fullName ?? suggestion.userId)
    .substring(0, 2)
    .toUpperCase();
  const percent = Math.round(suggestion.score * 100);
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();

  const onRequest = () => {
    if (!user) return;
    startTransition(async () => {
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
    });
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
        <Button className="w-full" onClick={onRequest} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Request Connection
        </Button>
        <Button className="w-full" variant="outline">
          View Profile
        </Button>
      </CardFooter>
    </Card>
  );
}
