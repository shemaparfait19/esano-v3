"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2 } from "lucide-react";
// import { getAssistantResponse } from '@/app/actions';
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { useAuth } from "@/contexts/auth-context";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

export function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    const userMessage: Message = { id: Date.now(), role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userMessage.text, userId: user?.uid }),
        });
        const data = await res.json();
        const assistantResponseText =
          data?.response ??
          "I'm sorry, I'm having trouble connecting right now. Please try again later.";
        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: "assistant",
          text: assistantResponseText,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: "I couldn't reach the assistant service. Please try again in a moment.",
          },
        ]);
      }
    });
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 border">
                  <div className="bg-primary flex items-center justify-center h-full w-full">
                    <Logo className="h-5 w-5 text-primary-foreground" />
                  </div>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isPending && (
            <div className="flex items-start gap-3 justify-start">
              <Avatar className="h-8 w-8 border">
                <div className="bg-primary flex items-center justify-center h-full w-full">
                  <Logo className="h-5 w-5 text-primary-foreground" />
                </div>
              </Avatar>
              <div className="max-w-xs p-3 rounded-lg bg-muted flex items-center">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your ancestry..."
            className="flex-1"
            disabled={isPending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
