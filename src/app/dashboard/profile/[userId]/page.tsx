"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function OtherUserProfilePage() {
  const params = useParams();
  const userId = (params?.userId as string) || "";
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [incomingId, setIncomingId] = useState<string | null>(null);
  const [outgoingExists, setOutgoingExists] = useState<boolean>(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!userId) return;
      const snap = await getDoc(doc(db, "users", userId));
      if (!ignore) setProfile(snap.exists() ? (snap.data() as any) : null);
      // detect pending requests for current viewer (if logged in) – incoming or outgoing
      if (user && user.uid) {
        const ref = collection(db, "connectionRequests");
        const [inSnap, outSnap] = await Promise.all([
          getDocs(
            query(
              ref,
              where("toUserId", "==", user.uid),
              where("fromUserId", "==", userId),
              where("status", "==", "pending")
            )
          ),
          getDocs(
            query(
              ref,
              where("fromUserId", "==", user.uid),
              where("toUserId", "==", userId),
              where("status", "==", "pending")
            )
          ),
        ]);
        if (!ignore) {
          setIncomingId(inSnap.docs[0]?.id ?? null);
          setOutgoingExists(outSnap.size > 0);
        }
      } else {
        if (!ignore) {
          setIncomingId(null);
          setOutgoingExists(false);
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [userId]);

  if (loading) return null;

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-2xl">Profile</h1>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const name =
    profile.fullName ||
    [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          {name || "Profile"}
        </h1>
        {profile.location && (
          <p className="mt-2 text-lg text-muted-foreground">
            {profile.location}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">
            Overview
          </CardTitle>
          <CardDescription>Basic information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {profile.birthDate && (
            <div>
              <div className="text-sm text-muted-foreground">Birth Date</div>
              <div>{profile.birthDate}</div>
            </div>
          )}
          {profile.birthPlace && (
            <div>
              <div className="text-sm text-muted-foreground">Birth Place</div>
              <div>{profile.birthPlace}</div>
            </div>
          )}
          {profile.nationality && (
            <div>
              <div className="text-sm text-muted-foreground">Nationality</div>
              <div>{profile.nationality}</div>
            </div>
          )}
          {profile.preferredLanguage && (
            <div>
              <div className="text-sm text-muted-foreground">
                Preferred Language
              </div>
              <div>{profile.preferredLanguage}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {Array.isArray(profile.education) && profile.education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">
              Education
            </CardTitle>
            <CardDescription>Education history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.education.map((e: any, idx: number) => (
              <div key={idx} className="grid gap-1">
                <div className="font-medium">
                  {e.institutionName || e.institutionType || "Institution"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[e.level, e.fieldOfStudy].filter(Boolean).join(" · ")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[e.startYear, e.endYear].filter(Boolean).join(" - ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(profile.work) && profile.work.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">
              Work
            </CardTitle>
            <CardDescription>Employment summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.work.map((w: any, idx: number) => (
              <div key={idx} className="grid gap-1">
                <div className="font-medium">
                  {w.companyName || w.department || "Company"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[w.jobTitle, w.employmentType].filter(Boolean).join(" · ")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[w.startYear, w.endYear].filter(Boolean).join(" - ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {user && user.uid !== userId && (
        <div className="mt-4 flex gap-2">
          {incomingId ? (
            <>
              <Button
                size="sm"
                onClick={async () => {
                  await setDoc(
                    doc(db, "connectionRequests", incomingId!),
                    {
                      status: "accepted",
                      respondedAt: new Date().toISOString(),
                    },
                    { merge: true }
                  );
                  toast({ title: "Request accepted" });
                  setIncomingId(null);
                }}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await setDoc(
                    doc(db, "connectionRequests", incomingId!),
                    {
                      status: "declined",
                      respondedAt: new Date().toISOString(),
                    },
                    { merge: true }
                  );
                  toast({ title: "Request declined" });
                  setIncomingId(null);
                }}
              >
                Decline
              </Button>
            </>
          ) : outgoingExists ? (
            <div className="text-sm text-muted-foreground">Request pending</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
