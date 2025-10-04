"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, User, Loader2 } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Reduced timeout to 8 seconds to match API
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.text,
          userId: user?.uid,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      const assistantResponseText =
        data?.response ||
        (data?.error
          ? `Error: ${data.error}${data.detail ? ` — ${data.detail}` : ""}`
          : "Assistant is temporarily unavailable. Please try again.");

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        text: assistantResponseText,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      // Don't show error if request was aborted intentionally
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: "Request timed out. Please try a shorter question or try again.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            text: "Failed to connect. Please check your connection and try again.",
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <div className="mb-4">
                <Logo className="h-12 w-12 mx-auto text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Ask about your ancestry
              </h3>
              <p className="text-sm">
                Ask me anything about genealogy, family connections, or DNA
                analysis
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 border shrink-0">
                  <div className="bg-primary flex items-center justify-center h-full w-full">
                    <Logo className="h-5 w-5 text-primary-foreground" />
                  </div>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 border shrink-0">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <Avatar className="h-8 w-8 border shrink-0">
                <div className="bg-primary flex items-center justify-center h-full w-full">
                  <Logo className="h-5 w-5 text-primary-foreground" />
                </div>
              </Avatar>
              <div className="max-w-xs p-3 rounded-xl bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
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
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
