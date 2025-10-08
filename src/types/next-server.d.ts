declare module "next/server" {
  // Minimal declarations to satisfy linter/types in API route context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const NextResponse: any;
}
