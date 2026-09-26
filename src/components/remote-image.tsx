"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "./icons";

/**
 * A product photograph from the source's image CDN, shown on a light stage.
 *
 * `unoptimized` loads the image directly from its source URL: nothing is
 * proxied, resized, cached or stored by this app. `no-referrer` keeps this
 * site's URLs out of the request. A missing or failed image shows a neutral
 * placeholder, never a stand-in photograph.
 */
export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
  padding = "p-4",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  padding?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`stage ${className}`}>
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`object-contain ${padding}`}
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
          <ImageIcon size={26} />
          <span className="text-xs font-medium">No image in the listing</span>
        </span>
      )}
    </div>
  );
}
