"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { Bell, LogOut, Mail, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function RequesterName({ userId }: { userId: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const d = snap.exists() ? (snap.data() as any) : null;
        if (!ignore)
          setName(d?.fullName || d?.preferredName || d?.firstName || null);
      } catch {}
    }
    load();
    return () => {
      ignore = true;
    };
  }, [userId]);
  return <>{name || userId.substring(0, 6)}</>;
}

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [recentMsgs, setRecentMsgs] = useState<any[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [accessRequestCount, setAccessRequestCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  useEffect(() => {
    if (!user?.uid) return;
    const ref = collection(db, "connectionRequests");
    const q = query(
      ref,
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setPendingItems(items);
        setPendingCount(items.length);
      },
      () => {
        setPendingItems([]);
        setPendingCount(0);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Load profile picture from Firestore profile
  useEffect(() => {
    let ignore = false;
    async function loadProfile() {
      try {
        if (!user?.uid) return;
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!ignore && snap.exists()) {
          const d = snap.data() as any;
          setProfilePhoto(d?.profilePicture || null);
        }
      } catch {
        // ignore
      }
    }
    loadProfile();
    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  // Live unread messages and recent list
  useEffect(() => {
    if (!user?.uid) return;
    const ref = collection(db, "messages");
    const qUnread = query(
      ref,
      where("receiverId", "==", user.uid),
      where("isRead", "==", false)
    );
    const qRecentTo = query(ref, where("receiverId", "==", user.uid));
    const qRecentFrom = query(ref, where("senderId", "==", user.uid));
    const unsubA = onSnapshot(
      qUnread,
      (snap) => setUnreadMsgCount(snap.size),
      () => setUnreadMsgCount(0)
    );
    const updateRecent = (docs: any[]) => {
      const map = new Map<string, any>();
      for (const d of docs) {
        const m = { id: d.id, ...(d.data() as any) };
        const peer = m.senderId === user.uid ? m.receiverId : m.senderId;
        const prev = map.get(peer);
        if (!prev || (prev.createdAt || "") < (m.createdAt || ""))
          map.set(peer, m);
      }
      setRecentMsgs(
        Array.from(map.values()).sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || "")
        )
      );
    };
    const unsubB = onSnapshot(qRecentTo, (snap) => updateRecent(snap.docs));
    const unsubC = onSnapshot(qRecentFrom, (snap) => updateRecent(snap.docs));
    return () => {
      unsubA();
      unsubB();
      unsubC();
    };
  }, [user?.uid]);

  // Load family tree access requests with real-time updates
  useEffect(() => {
    if (!user?.uid) return;
    console.log("🔍 Loading family tree access requests for user:", user.uid);
    const ref = collection(db, "familyTreeAccessRequests");
    const q = query(
      ref,
      where("ownerId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log("📋 Access requests snapshot:", snap.size, "docs found");
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          console.log("📄 Request data:", { id: d.id, ...data });
          return {
            id: d.id,
            ...data,
          };
        });
        console.log("✅ Processed access requests:", items);
        setAccessRequests(items);
        setAccessRequestCount(items.length);
      },
      (error) => {
        console.error("❌ Error loading access requests:", error);
        setAccessRequests([]);
        setAccessRequestCount(0);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Load notifications with real-time updates
  useEffect(() => {
    if (!user?.uid) return;
    console.log("🔔 Loading notifications for user:", user.uid);
    const ref = collection(db, "notifications");
    const q = query(
      ref,
      where("userId", "==", user.uid),
      where("status", "==", "unread")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log("🔔 Notifications snapshot:", snap.size, "docs found");
        const items = snap.docs.map((d) => {
          const data = d.data() as any;
          console.log("📄 Notification data:", { id: d.id, ...data });
          return {
            id: d.id,
            ...data,
          };
        });
        console.log("✅ Processed notifications:", items);
        setNotifications(items);
        setNotificationCount(items.length);
      },
      (error) => {
        console.error("❌ Error loading notifications:", error);
        setNotifications([]);
        setNotificationCount(0);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Mail />
              {unreadMsgCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadMsgCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Messages</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recentMsgs.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No messages
              </div>
            )}
            {recentMsgs.map((m) => (
              <div key={m.id} className="px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">
                    {m.senderId === user?.uid ? "To" : "From"}:
                  </span>{" "}
                  {m.senderId === user?.uid ? (
                    <RequesterName userId={m.receiverId} />
                  ) : (
                    <RequesterName userId={m.senderId} />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.text}
                </div>
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      router.push(
                        `/dashboard/messages?peer=${
                          m.senderId === user?.uid ? m.receiverId : m.senderId
                        }`
                      )
                    }
                  >
                    Open chat
                  </Button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push("/dashboard/messages")}
            >
              Go to Messages
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Users />
              {accessRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {accessRequestCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Family Tree Access Requests</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accessRequests.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No access requests
              </div>
            )}
            {accessRequests.map((r) => (
              <div key={r.id} className="px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">From:</span>{" "}
                  <RequesterName userId={r.requesterId} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Role: {r.access} •{" "}
                  {new Date(
                    r.createdAt?.toDate?.() || r.createdAt
                  ).toLocaleDateString()}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          "/api/family-tree/access-request",
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: r.id,
                              decision: "accept",
                            }),
                          }
                        );
                        if (res.ok) {
                          // Request will be removed from the list automatically via the real-time listener
                        }
                      } catch (error) {
                        console.error("Failed to accept request:", error);
                      }
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          "/api/family-tree/access-request",
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: r.id,
                              decision: "deny",
                            }),
                          }
                        );
                        if (res.ok) {
                          // Request will be removed from the list automatically via the real-time listener
                        }
                      } catch (error) {
                        console.error("Failed to decline request:", error);
                      }
                    }}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      console.log(
                        "🔍 Navigating to profile for requester:",
                        r.requesterId
                      );
                      router.push(`/dashboard/profile/${r.requesterId}`);
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push("/dashboard/family-tree")}
            >
              Go to Family Tree
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Bell />
              {pendingCount + notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount + notificationCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Connection Requests */}
            {pendingItems.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                  Connection Requests
                </div>
                {pendingItems.map((r) => (
                  <div key={r.id} className="px-3 py-2">
                    <div className="text-sm">
                      From: <RequesterName userId={r.fromUserId} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await fetch("/api/requests", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: r.id,
                              status: "accepted",
                            }),
                          });
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await fetch("/api/requests", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: r.id,
                              status: "declined",
                            }),
                          });
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Family Tree Notifications */}
            {notifications.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                  Family Tree Updates
                </div>
                {notifications.map((n) => (
                  <div key={n.id} className="px-3 py-2">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.message}
                    </div>
                    {n.type === "tree_access_accepted" && (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          // Mark as read and navigate to shared trees
                          fetch("/api/notifications/mark-read", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ notificationId: n.id }),
                          });
                          router.push("/dashboard/shared-trees");
                        }}
                      >
                        View Shared Trees
                      </Button>
                    )}
                  </div>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {pendingItems.length === 0 && notifications.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No notifications
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push("/dashboard/notifications")}
            >
              View All Notifications
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex-1 sm:flex-initial" />
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/shared-trees")}
        >
          Shared Trees
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={
                    profilePhoto ||
                    user?.photoURL ||
                    `https://picsum.photos/seed/${user?.uid}/100`
                  }
                  alt={user?.displayName || "User"}
                  data-ai-hint="person face"
                />
                <AvatarFallback>
                  {user?.email?.[0].toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user?.displayName || user?.email || "My Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
