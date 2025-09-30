import { cn } from "@/lib/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-primary", className)}
      {...props}
    >
      <path d="M4.65 13.35c-1.48-1.48-2.3-3.48-2.3-5.65s.82-4.17 2.3-5.65" />
      <path d="M19.35 10.65c1.48 1.48 2.3 3.48 2.3 5.65s-.82 4.17-2.3 5.65" />
      <path d="M11.23 2.32c.45-.29.93-.53 1.42-.72" />
      <path d="M11.41 21.68c.52.22 1.07.32 1.63.32" />
      <path d="M7.4 5.4c-1.78 1.78-2.8 4.2-2.8 6.8" />
      <path d="M16.6 18.6c1.78-1.78 2.8-4.2 2.8-6.8" />
      <path d="M7.4 12.2c0-1.78 1.02-3.3 2.8-4.2" />
      <path d="M13.8 14c1.78.9 2.8 2.42 2.8 4.2" />
      <path d="M7.89 4.32c.5-.2 1.02-.32 1.56-.32" />
      <path d="M14.55 19.98c.54 0 1.06-.12 1.55-.32" />
      <path d="M4.65 2.35C6.13.87 8.13 0 10.3 0" />
      <path d="M13.7 24c2.17 0 4.17-.87 5.65-2.35" />
    </svg>
  );
}
