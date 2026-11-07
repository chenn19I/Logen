import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Logen mascot: a cybernetic wizard in a wide-brimmed hat, cyan goggles,
 * a white beard, a blue robe and a staff crowned with a glowing cube.
 * The raster portrait is the original artwork, framed as a club relic.
 */
export function LogenMascot({
  size = 420,
  aspectRatio = "1 / 1",
  className,
  imageClassName,
  priority = false,
  caption = "Logen / Keeper of the seat",
  showSparks = true,
}: {
  size?: number;
  aspectRatio?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  caption?: string | null;
  showSparks?: boolean;
}) {
  return (
    <div
      className={cn(
        "mascot-frame relative isolate overflow-hidden rounded border border-line bg-[#05070d]",
        className
      )}
      style={{ width: size, maxWidth: "100%", aspectRatio }}
    >
      <div className="mascot-aura pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="mascot-cube-glow pointer-events-none absolute left-[14%] top-[6%] h-[38%] w-[38%] rounded-full" aria-hidden="true" />

      <Image
        src="/logen-mascot.png"
        alt="Logen mascot: a pixel-art cybernetic wizard in a wide blue hat and robe, with cyan goggles, a white beard, a staff holding a glowing blue cube, and a small floating robot."
        fill
        priority={priority}
        sizes="(max-width: 640px) 80vw, 420px"
        className={cn(
          "mascot-float object-cover object-[50%_46%] mix-blend-screen",
          imageClassName
        )}
      />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,7,13,0.55)_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,13,0.08),transparent_28%,transparent_68%,rgba(5,7,13,0.78))]"
        aria-hidden="true"
      />

      {showSparks ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="mascot-spark absolute left-[14%] top-[28%] h-1.5 w-1.5 bg-[#4de8ff]" />
          <span className="mascot-spark mascot-spark-2 absolute right-[16%] top-[36%] h-1 w-1 bg-[#6ab7ff]" />
          <span className="mascot-spark mascot-spark-3 absolute left-[22%] bottom-[22%] h-1 w-1 bg-[#ece8d8]" />
          <span className="mascot-spark mascot-spark-4 absolute right-[26%] top-[16%] h-1.5 w-1.5 bg-[#4de8ff]" />
        </div>
      ) : null}

      {caption ? (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
          <span className="font-mono text-[10px] uppercase tracking-label text-[#4de8ff]">
            {caption}
          </span>
          <span className="hidden font-mono text-[9px] uppercase tracking-label text-paper-muted sm:inline">
            Pixel · 2026
          </span>
        </div>
      ) : null}
    </div>
  );
}
