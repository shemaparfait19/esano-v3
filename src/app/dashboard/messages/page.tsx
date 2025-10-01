"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type ChatSummary = { peerId: string; lastMessage: string; createdAt: string };
type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
  isRead?: boolean;
  delivered?: boolean;
};

function PeerName({ userId }: { userId: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const d = snap.exists() ? (snap.data() as any) : null;
        if (!ignore) {
          const nm =
            d?.fullName ||
            d?.preferredName ||
            [d?.firstName, d?.middleName, d?.lastName]
              .filter(Boolean)
              .join(" ");
          setName(nm || null);
        }
      } catch {}
    }
    load();
    return () => {
      ignore = true;
    };
  }, [userId]);
  return <>{name || userId}</>;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [list, setList] = useState<ChatSummary[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>({});

  // Live chat list (latest per peer)
  useEffect(() => {
    if (!user?.uid) return;
    const ref = collection(db, "messages");
    const qFrom = query(ref, where("senderId", "==", user.uid));
    const qTo = query(ref, where("receiverId", "==", user.uid));
    const peers = new Map<string, ChatSummary>();

    const update = (docs: any[]) => {
      for (const d of docs) {
        const m = { id: d.id, ...(d.data() as any) } as any;
        if (m.senderId !== user.uid && m.receiverId !== user.uid) continue;
        const peer = m.senderId === user.uid ? m.receiverId : m.senderId;
        const prev = peers.get(peer);
        if (!prev || (prev.createdAt || "") < (m.createdAt || "")) {
          peers.set(peer, {
            peerId: peer,
            lastMessage: m.text,
            createdAt: m.createdAt,
          });
        }
      }
      const arr = Array.from(peers.values());
      arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setList(arr);
    };

    const unsubA = onSnapshot(qFrom, (snap) => update(snap.docs));
    const unsubB = onSnapshot(qTo, (snap) => update(snap.docs));
    // If deep-link peer param is present, select it
    const initialPeer = searchParams?.get("peer");
    if (initialPeer) setActivePeer(initialPeer);
    // Unread by peer listener
    const qUnread = query(
      ref,
      where("receiverId", "==", user.uid),
      where("isRead", "==", false)
    );
    const unsubUnread = onSnapshot(
      qUnread,
      (snap) => {
        const counts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const m = d.data() as any;
          const peer = m.senderId as string;
          counts[peer] = (counts[peer] || 0) + 1;
        });
        setUnreadByPeer(counts);
      },
      () => setUnreadByPeer({})
    );
    return () => {
      unsubA();
      unsubB();
      unsubUnread();
    };
  }, [user?.uid]);

  // Auto-select first chat if none selected and list populated
  useEffect(() => {
    if (!activePeer && list.length > 0) {
      const initialPeer = searchParams?.get("peer");
      setActivePeer(initialPeer || list[0].peerId);
    }
  }, [activePeer, list]);

  // Live thread between me and active peer (two queries, merged)
  useEffect(() => {
    if (!user?.uid || !activePeer) return;
    const ref = collection(db, "messages");
    const q1 = query(
      ref,
      where("senderId", "==", user.uid),
      where("receiverId", "==", activePeer)
    );
    const q2 = query(
      ref,
      where("senderId", "==", activePeer),
      where("receiverId", "==", user.uid)
    );

    let current: Message[] = [];
    const mergeUpdate = () => {
      const sorted = [...current].sort((a, b) =>
        (a.createdAt || "").localeCompare(b.createdAt || "")
      );
      setMessages(sorted);
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      const part = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) } as any)
      );
      current = [
        ...part.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          text: m.text,
          createdAt: m.createdAt,
        })),
        ...current.filter(
          (m) => !(m.senderId === user.uid && m.receiverId === activePeer)
        ),
      ];
      mergeUpdate();
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      const part = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) } as any)
      );
      current = [
        ...part.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          text: m.text,
          createdAt: m.createdAt,
        })),
        ...current.filter(
          (m) => !(m.senderId === activePeer && m.receiverId === user.uid)
        ),
      ];
      mergeUpdate();
    });
    // Mark incoming messages as read when opening the thread
    fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: user.uid, senderId: activePeer }),
    }).catch(() => {});
    // Optimistically update local state for read receipts
    setMessages((prev) =>
      prev.map((m) =>
        m.senderId === activePeer && m.receiverId === user.uid
          ? { ...m, isRead: true }
          : m
      )
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [user?.uid, activePeer]);

  const send = async () => {
    if (!user?.uid || !activePeer || !text.trim()) return;
    const body = { fromUserId: user.uid, toUserId: activePeer, text };
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setText("");
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">
            Chats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && (
            <div className="text-sm text-muted-foreground">No chats yet</div>
          )}
          {list.map((c) => (
            <div key={c.peerId} className="flex items-center gap-2">
              <Button
                variant={activePeer === c.peerId ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setActivePeer(c.peerId)}
              >
                <PeerName userId={c.peerId} />
              </Button>
              {unreadByPeer[c.peerId] ? (
                <span className="inline-flex items-center justify-center text-xs bg-green-600 text-white rounded-full h-5 px-2">
                  {unreadByPeer[c.peerId]}
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">
            Conversation{" "}
            {activePeer && (
              <span className="text-muted-foreground">
                – <PeerName userId={activePeer} />
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-[60vh]">
          <div className="flex-1 overflow-auto space-y-2 border rounded p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.senderId === user?.uid ? "text-right" : "text-left"
                }
              >
                <div className="inline-block bg-muted rounded px-2 py-1 text-sm max-w-[75%]">
                  {m.text}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                  {m.senderId === user?.uid && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {m.isRead ? "seen" : m.delivered ? "delivered" : "sent"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message"
            />
            <Button onClick={send} disabled={!activePeer || !text.trim()}>
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
