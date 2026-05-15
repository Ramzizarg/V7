"use client";

import Image from "next/image";

type Props = {
  className?: string;
  /** Slightly tighter type + icon for narrow home carousel cells */
  compact?: boolean;
  /** Product photo shown faintly (~40%) behind the coming-soon layer */
  imageUrl?: string | null;
};

/**
 * Product-slot teaser when a listing is not yet available (inactive).
 * Same aspect ratio as product cards; optional cover image at low opacity.
 */
export function ComingSoonPlaceholder({ className = "", compact, imageUrl }: Props) {
  const src = typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl.trim() : null;
  const isRemote = src != null && src.startsWith("http");

  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden border border-black/50 bg-zinc-950 antialiased selection:bg-transparent ${className}`.trim()}
      role="status"
      aria-label="Coming soon"
    >
      {src ? (
        <>
          <Image
            src={src}
            alt=""
            fill
            className="object-cover object-center opacity-40"
            sizes={compact ? "(max-width: 640px) 200px, 240px" : "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"}
            unoptimized={isRemote}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/45"
            aria-hidden
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-zinc-950" aria-hidden />
      )}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-white ${compact ? "gap-3 sm:gap-4" : "gap-4 sm:gap-5"}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`shrink-0 text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${compact ? "h-9 w-9 sm:h-10 sm:w-10" : "h-10 w-10 sm:h-11 sm:w-11"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="9.5" rx="1.25" />
          <path d="M9 11V7.75a3 3 0 0 1 6 0V11" />
        </svg>
        <span
          className={`max-w-[90%] px-2 text-center font-semibold uppercase leading-tight tracking-[0.28em] text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:tracking-[0.32em] ${compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]"}`}
        >
          Coming soon
        </span>
      </div>
    </div>
  );
}
