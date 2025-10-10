"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, User, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { useAuth } from "@/contexts/auth-context";

type Message = {
  id: number;
  role: "user" | "assistant" | "system";
  text: string;
  provider?: string;
  elapsed?: number;
};

export function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    checked: boolean;
    hasGemini: boolean;
    hasOpenRouter: boolean;
    hasDeepseek: boolean;
  }>({
    checked: false,
    hasGemini: false,
    hasOpenRouter: false,
    hasDeepseek: false,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Check system status on mount
  useEffect(() => {
    checkSystemStatus();
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkSystemStatus = async () => {
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "__diag", userId: user?.uid }),
      });

      if (res.ok) {
        const data = await res.json();
        setSystemStatus({
          checked: true,
          hasGemini: data.hasGemini,
          hasOpenRouter: data.hasOpenRouter,
          hasDeepseek: data.hasDeepseek,
        });
        console.log("System status:", data);
      }
    } catch (e) {
      console.error("Failed to check system status:", e);
    }
  };

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
      // Longer timeout since we're doing more work
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        provider: data?.meta?.provider,
        elapsed: data?.meta?.elapsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Request error:", err);

      let errorMessage =
        "Failed to connect. Please check your connection and try again.";

      if (err.name === "AbortError") {
        errorMessage =
          "Request timed out. This might mean:\n• Your family tree data is very large\n• The AI service is slow\n• Network connection is poor\n\nTry asking a simpler question or try again.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      {/* System Status Bar */}
      {systemStatus.checked && (
        <div className="border-b px-4 py-2 bg-muted/50">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium">AI Providers:</span>
            <div className="flex items-center gap-1">
              {systemStatus.hasGemini ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-600" />
              )}
              <span>Gemini</span>
            </div>
            <div className="flex items-center gap-1">
              {systemStatus.hasOpenRouter ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-600" />
              )}
              <span>OpenRouter</span>
            </div>
            <div className="flex items-center gap-1">
              {systemStatus.hasDeepseek ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-600" />
              )}
              <span>DeepSeek</span>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <div className="mb-4">
                <Logo className="h-12 w-12 mx-auto text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Ask about your family tree
              </h3>
              <p className="text-sm mb-4">
                I have access to your complete family tree data, relationships,
                and history
              </p>
              <div className="text-xs space-y-1 text-left bg-muted/50 p-3 rounded-lg">
                <p className="font-medium mb-1">Try asking:</p>
                <p>• "Tell me about my grandparents"</p>
                <p>• "Who are all my siblings?"</p>
                <p>• "List everyone in my family tree"</p>
                <p>• "What do you know about my family?"</p>
              </div>
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
                  "max-w-xs md:max-w-md lg:max-w-lg rounded-xl",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground p-3"
                    : "bg-muted p-3"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                {message.provider && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                    <span>via {message.provider}</span>
                    {message.elapsed && (
                      <span>{(message.elapsed / 1000).toFixed(2)}s</span>
                    )}
                  </div>
                )}
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
                  Analyzing your family tree...
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
            placeholder="Ask about your family tree..."
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
        <p className="text-xs text-muted-foreground mt-2">
          {systemStatus.checked &&
            !systemStatus.hasGemini &&
            !systemStatus.hasOpenRouter &&
            !systemStatus.hasDeepseek && (
              <span className="text-orange-600">
                ⚠️ No AI providers configured. Please add API keys.
              </span>
            )}
        </p>
      </div>
    </div>
  );
}
