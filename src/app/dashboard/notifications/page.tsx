"use client";

import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user) return;
      const ref = collection(db, "connectionRequests");
      try {
        const incomingQ = query(
          ref,
          where("toUserId", "==", user.uid),
          where("status", "==", "pending")
        );
        const outgoingQ = query(
          ref,
          where("fromUserId", "==", user.uid),
          where("status", "==", "pending")
        );
        const [inSnap, outSnap] = await Promise.all([
          getDocs(incomingQ),
          getDocs(outgoingQ),
        ]);
        if (!ignore) {
          setIncoming(inSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setOutgoing(outSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch {
        if (!ignore) {
          setIncoming([]);
          setOutgoing([]);
        }
      }

      // Load notifications
      try {
        const notifRef = collection(db, "notifications");
        const notifQ = query(
          notifRef,
          where("userId", "==", user.uid),
          where("status", "==", "unread")
        );
        const notifSnap = await getDocs(notifQ);
        if (!ignore) {
          setNotifications(
            notifSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        }
      } catch {
        if (!ignore) {
          setNotifications([]);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [user]);

  const act = async (id: string, status: "accepted" | "declined") => {
    await setDoc(
      doc(db, "connectionRequests", id),
      { status, respondedAt: new Date().toISOString() },
      { merge: true }
    );
    // reload lists
    if (!user) return;
    const ref = collection(db, "connectionRequests");
    const incomingQ = query(
      ref,
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );
    const outgoingQ = query(
      ref,
      where("fromUserId", "==", user.uid),
      where("status", "==", "pending")
    );
    const [inSnap, outSnap] = await Promise.all([
      getDocs(incomingQ),
      getDocs(outgoingQ),
    ]);
    setIncoming(inSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setOutgoing(outSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold text-primary md:text-4xl">
          Notifications
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage your connection requests.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">
              Incoming Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incoming.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No incoming requests.
              </p>
            )}
            {incoming.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border p-3 rounded-md"
              >
                <div>
                  <div className="font-medium">From: {r.fromUserId}</div>
                  <div className="text-sm text-muted-foreground">
                    Request ID: {r.id}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(r.id, "accepted")}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(r.id, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">
              Outgoing Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoing.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No outgoing requests.
              </p>
            )}
            {outgoing.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border p-3 rounded-md"
              >
                <div>
                  <div className="font-medium">To: {r.toUserId}</div>
                  <div className="text-sm text-muted-foreground">
                    Request ID: {r.id}
                  </div>
                </div>
                <div className="text-xs">Pending</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Family Tree Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">
              Family Tree Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between border p-3 rounded-md"
              >
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {n.message}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  {n.type === "tree_access_accepted" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        // Mark as read and navigate to shared trees
                        await fetch("/api/notifications/mark-read", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ notificationId: n.id }),
                        });
                        window.location.href = "/dashboard/shared-trees";
                      }}
                    >
                      View Shared Trees
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await fetch("/api/notifications/mark-read", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notificationId: n.id }),
                      });
                      // Remove from local state
                      setNotifications(
                        notifications.filter((notif) => notif.id !== n.id)
                      );
                    }}
                  >
                    Mark Read
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
