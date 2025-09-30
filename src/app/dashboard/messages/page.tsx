"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatSummary = { peerId: string; lastMessage: string; createdAt: string };
type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ChatSummary[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user?.uid) return;
      const res = await fetch(`/api/chat/list?userId=${user.uid}`);
      const data = await res.json();
      if (!ignore && data?.chats) setList(data.chats);
    }
    load();
    const iv = setInterval(load, 5000);
    return () => {
      ignore = true;
      clearInterval(iv);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !activePeer) return;
    let ignore = false;
    async function loadThread() {
      const res = await fetch(
        `/api/chat/messages?a=${user.uid}&b=${activePeer}`
      );
      const data = await res.json();
      if (!ignore && data?.messages) setMessages(data.messages);
    }
    loadThread();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(loadThread, 3000);
    return () => {
      ignore = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.uid, activePeer]);

  const send = async () => {
    if (!user?.uid || !activePeer || !text.trim()) return;
    const body = { fromUserId: user.uid, toUserId: activePeer, text };
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setText("");
      const data = await fetch(
        `/api/chat/messages?a=${user.uid}&b=${activePeer}`
      ).then((r) => r.json());
      if (data?.messages) setMessages(data.messages);
    }
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
            <Button
              key={c.peerId}
              variant={activePeer === c.peerId ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setActivePeer(c.peerId)}
            >
              {c.peerId}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">
            Conversation
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
