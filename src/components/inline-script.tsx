"use client";

/**
 * A script that runs once, during HTML parsing, before the first paint.
 * React warns when a render on the client produces a <script>; on the
 * client this renders an inert text/plain script instead, and
 * suppressHydrationWarning accepts the difference. (The pattern from the
 * Next.js guide "Preventing flash before hydration".)
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
