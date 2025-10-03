import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src="/assets/logo.png"
        alt="Esano"
        fill
        className="object-contain"
      />
    </div>
  );
}
