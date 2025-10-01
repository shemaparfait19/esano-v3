"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import ChatAssistant from "@/components/dashboard/chat-assistant";

type FloatingAssistantProps = {
  gifSrc?: string; // path under public/
  title?: string;
};

export default function FloatingAssistant({
  gifSrc = "/assets/esano-assistant.gif",
  title = "eSANO Assistant",
}: FloatingAssistantProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <div className="fixed right-4 bottom-4 z-[60]">
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetTrigger asChild>
                <Button
                  aria-label="Open eSANO Assistant"
                  className="h-14 w-14 rounded-full p-0 shadow-lg border bg-white hover:scale-105 transition-transform"
                  variant="outline"
                >
                  {/* Fallback circle if GIF missing */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gifSrc}
                    alt="eSANO Assistant"
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </Button>
              </SheetTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-sm">
              Ask {title}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-3.5rem)]">
          <ChatAssistant placeholder="Ask eSANO Assistant anything..." />
        </div>
      </SheetContent>
    </Sheet>
  );
}
