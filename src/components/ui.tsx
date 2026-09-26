/** Layout and state primitives. Server-safe: no hooks. */

import type { ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./icons";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Empty, error and informational states, all in one honest shape. */
export function StatePanel({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: "neutral" | "error";
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "error" ? AlertIcon : InfoIcon;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className="glass flex flex-col items-center px-6 py-12 text-center"
    >
      <span
        className={`flex size-11 items-center justify-center rounded-2xl border ${
          tone === "error"
            ? "border-negative/40 bg-negative/10 text-negative"
            : "border-line-strong bg-white/5 text-accent-strong"
        }`}
      >
        <Icon size={20} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-fg">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

/** The notice that goes wherever a purchase-like action appears. */
export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`flex gap-2 text-xs leading-relaxed text-fg-subtle ${className}`}>
      <InfoIcon size={15} className="mt-px shrink-0" />
      <span>
        Demo order flow. Nexus does not sell, stock or ship products — no payment is taken and
        nothing is delivered. Prices come from the source listing when it was collected.
      </span>
    </p>
  );
}
