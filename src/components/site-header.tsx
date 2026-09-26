import Link from "next/link";
import { VetraMark } from "./icons";
import { SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-graphite-950/80 backdrop-blur-xl">
      <div className="container-app flex h-14 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl py-1 pr-2">
          <VetraMark size={26} />
          <span className="text-base font-semibold tracking-tight text-fg">Vetra</span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
