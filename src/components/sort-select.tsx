"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SORT_OPTIONS } from "@/lib/sort";
import type { SortKey } from "@/lib/types";
import { ChevronDownIcon } from "./icons";

/** Sorting stays in the URL exactly as before — this only saves the shopper a
 *  second click compared with a form and a submit button. Changing the select
 *  pushes the new URL, so the result is still shareable and the back button
 *  still steps through sort changes. */
export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-ink-muted">Sort by</span>
      <span className="relative inline-flex items-center">
        <select
          value={value}
          disabled={pending}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            next.set("sort", event.target.value);
            startTransition(() => router.push(`/search?${next.toString()}`));
          }}
          className="appearance-none rounded-md border border-border-strong bg-surface py-1.5 pl-2.5 pr-8 text-sm font-medium disabled:opacity-60"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={15}
          className="pointer-events-none absolute right-2 text-ink-muted"
        />
      </span>
    </label>
  );
}
