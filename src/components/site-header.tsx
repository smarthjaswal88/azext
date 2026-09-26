import Link from "next/link";
import { NexusMark } from "./icons";
import { SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-graphite-950/75 backdrop-blur-xl">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 rounded-xl py-1 pr-2">
          <NexusMark size={30} />
          <span className="text-lg font-semibold tracking-tight text-fg">Nexus</span>
          <span className="hidden rounded-full border border-line-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle md:inline">
            Product intelligence
          </span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
