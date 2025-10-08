// @ts-nocheck
"use client";

import { useAppContext } from "@/contexts/app-context";
import { RelativeCard } from "@/components/dashboard/relative-card";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dna, Users, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function RelativesPage() {
  const { relatives, isAnalyzing, analysisCompleted } = useAppContext();
  const { user } = useAuth() as any;
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user?.uid) return;
      try {
        const conRef = collection(db, "connections");
        const snap = await getDocs(
          query(
            conRef,
            where("participants", "array-contains", user.uid),
            where("status", "==", "connected")
          )
        );
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const arr = ((d.data() as any)?.participants || []) as string[];
          arr.forEach((id) => {
            if (id !== user.uid) ids.add(id);
          });
        });

        // Fallback: infer connections from accepted connectionRequests in either direction
        if (ids.size === 0) {
          try {
            const reqRef = collection(db, "connectionRequests");
            const [accOut, accIn] = await Promise.all([
              getDocs(
                query(
                  reqRef,
                  where("fromUserId", "==", user.uid),
                  where("status", "==", "accepted")
                )
              ),
              getDocs(
                query(
                  reqRef,
                  where("toUserId", "==", user.uid),
                  where("status", "==", "accepted")
                )
              ),
            ]);
            accOut.docs.forEach((d) => {
              const toId = (d.data() as any)?.toUserId;
              if (toId && toId !== user.uid) ids.add(toId);
            });
            accIn.docs.forEach((d) => {
              const fromId = (d.data() as any)?.fromUserId;
              if (fromId && fromId !== user.uid) ids.add(fromId);
            });
          } catch {}
        }
        if (!ignore) setConnectedIds(Array.from(ids));
      } catch {}
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  // Load minimal profiles for connected users (name + avatar)
  useEffect(() => {
    let ignore = false;
    async function loadProfiles() {
      if (connectedIds.length === 0) {
        setProfiles([]);
        return;
      }
      try {
        const results: any[] = [];
        // Firestore 'in' has limits; fetch individually for simplicity
        for (const uid of connectedIds) {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            const d = snap.exists() ? (snap.data() as any) : {};
            results.push({
              userId: uid,
              fullName:
                d.fullName ||
                d.displayName ||
                [d.firstName, d.middleName, d.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                uid.substring(0, 6),
              photoURL: d.profilePicture || d.photoURL || "",
              location: d.location || d.residenceDistrict || "",
            });
          } catch {}
        }
        if (!ignore) setProfiles(results);
      } catch {}
    }
    loadProfiles();
    return () => {
      ignore = true;
    };
  }, [connectedIds]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          DNA Relatives
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover and connect with potential relatives based on your DNA.
        </p>
      </div>

      {isAnalyzing && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isAnalyzing && !analysisCompleted && (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <Dna className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl text-primary mt-4">
              No DNA Data Found
            </CardTitle>
            <CardDescription>
              Upload your DNA file to start finding relatives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/dna-analysis">Upload DNA</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isAnalyzing &&
        analysisCompleted &&
        (!relatives || relatives.length === 0) && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto bg-secondary p-3 rounded-full w-fit">
                <Frown className="h-8 w-8 text-secondary-foreground" />
              </div>
              <CardTitle className="font-headline text-2xl mt-4">
                No Matches Found Yet
              </CardTitle>
              <CardDescription>
                We couldn't find any relatives in our database at this time. As
                more users join, you may get new matches.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

      {!isAnalyzing && profiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((p) => (
            <Card key={p.userId} className="flex flex-col">
              <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={p.photoURL} alt={p.fullName} />
                  <AvatarFallback>
                    {(p.fullName || "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="font-headline text-lg">
                    {p.fullName}
                  </CardTitle>
                  <CardDescription>
                    Connected • {p.location || ""}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Button asChild variant="secondary">
                  <Link
                    href={`/dashboard/profile/${encodeURIComponent(p.userId)}`}
                  >
                    View Profile
                  </Link>
                </Button>
                <Button asChild>
                  <Link
                    href={`/dashboard/messages?peer=${encodeURIComponent(
                      p.userId
                    )}`}
                  >
                    Message
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DNA Matches section retained below connected friends */}
      {!isAnalyzing &&
        analysisCompleted &&
        relatives &&
        relatives.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-headline text-2xl font-bold text-primary">
                DNA Matches
              </h2>
              <p className="text-muted-foreground">
                Potential relatives detected by your last analysis.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatives.map((relative, index) => (
                <RelativeCard
                  key={relative.userId || index}
                  relative={relative as any}
                />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
