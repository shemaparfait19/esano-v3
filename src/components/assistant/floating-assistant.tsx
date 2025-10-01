"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";

type FloatingAssistantProps = {
  gifSrc?: string; // path under public/
  title?: string;
};

export default function FloatingAssistant({
  gifSrc = "/assets/esano-assistant.gif",
  title = "eSANO Assistant",
}: FloatingAssistantProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Hide on assistant page
  if (pathname?.startsWith("/dashboard/assistant")) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="fixed right-4 bottom-4 z-[60]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Open eSANO Assistant"
              className="h-16 w-16 p-0 shadow-lg bg-transparent hover:scale-105 transition-transform border-0"
              variant="ghost"
              onClick={() => router.push("/dashboard/assistant")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gifSrc}
                alt="eSANO Assistant"
                className="h-16 w-16 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-sm">
            Ask {title}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
