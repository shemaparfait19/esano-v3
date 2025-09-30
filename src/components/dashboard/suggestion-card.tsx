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
import React, { useEffect, useState, useTransition } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where } from "firebase/firestore";

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
  const [incomingId, setIncomingId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user?.uid) return;
      try {
        const ref = collection(db, "connectionRequests");
        const [incomingSnap, outgoingSnap, acceptedA, acceptedB] =
          await Promise.all([
            getDocs(
              query(
                ref,
                where("fromUserId", "==", suggestion.userId),
                where("toUserId", "==", user.uid),
                where("status", "==", "pending")
              )
            ),
            getDocs(
              query(
                ref,
                where("fromUserId", "==", user.uid),
                where("toUserId", "==", suggestion.userId),
                where("status", "==", "pending")
              )
            ),
            getDocs(
              query(
                ref,
                where("fromUserId", "==", user.uid),
                where("toUserId", "==", suggestion.userId),
                where("status", "==", "accepted")
              )
            ),
            getDocs(
              query(
                ref,
                where("fromUserId", "==", suggestion.userId),
                where("toUserId", "==", user.uid),
                where("status", "==", "accepted")
              )
            ),
          ]);
        const incId = incomingSnap.docs[0]?.id ?? null;
        const outPending = outgoingSnap.size > 0;
        const accepted = acceptedA.size > 0 || acceptedB.size > 0;
        if (!ignore) {
          setIncomingId(incId);
          setRequested(outPending);
          setIsConnected(accepted);
        }
      } catch {}
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user?.uid, suggestion.userId]);

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

  const onMessage = () => {
    if (!user) return;
    if (isConnected) {
      router.push(`/dashboard/messages?peer=${suggestion.userId}`);
    }
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
          {isConnected && <Badge variant="default">Connected</Badge>}
          {!isConnected && (requested || incomingId) && (
            <Badge
              variant="outline"
              className="border-yellow-500 text-yellow-700"
            >
              Pending
            </Badge>
          )}
          {suggestion.reasons.slice(0, 3).map((r, idx) => (
            <Badge key={idx} variant="outline">
              {r}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        {!isConnected && !incomingId && (
          <Button
            className="w-full"
            onClick={onRequest}
            disabled={isPending || requested}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {requested ? "Requested" : "Request Connection"}
          </Button>
        )}
        {incomingId && !isConnected && (
          <>
            <Button
              className="w-full"
              onClick={async () => {
                await fetch("/api/requests", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: incomingId, status: "accepted" }),
                });
                setIncomingId(null);
                setIsConnected(true);
                toast({ title: "Connection accepted" });
              }}
            >
              Accept
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                await fetch("/api/requests", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: incomingId, status: "declined" }),
                });
                setIncomingId(null);
                setRequested(false);
                toast({ title: "Connection declined" });
              }}
            >
              Decline
            </Button>
          </>
        )}
        <Button className="w-full" variant="outline" onClick={onViewProfile}>
          View Profile
        </Button>
        {isConnected && (
          <Button className="w-full" variant="secondary" onClick={onMessage}>
            <MessageCircle className="mr-2 h-4 w-4" /> Message
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
