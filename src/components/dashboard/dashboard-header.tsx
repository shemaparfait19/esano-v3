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
import { Bell, LogOut, User } from "lucide-react";
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
  return <>{name || userId}</>;
}

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

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

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Bell />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Pending Requests</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pendingItems.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No pending requests
              </div>
            )}
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
                        body: JSON.stringify({ id: r.id, status: "accepted" }),
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
                        body: JSON.stringify({ id: r.id, status: "declined" }),
                      });
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push("/dashboard/notifications")}
            >
              Open Notifications
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex-1 sm:flex-initial" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={
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
