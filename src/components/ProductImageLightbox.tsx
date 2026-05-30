"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";

type Props = {
  open: boolean;
  onClose: () => void;
  images: string[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  productName: string;
};

export function ProductImageLightbox({
  open,
  onClose,
  images,
  activeIndex,
  onActiveChange,
  productName,
}: Props) {
  const [zoomed2x, setZoomed2x] = useState(false);

  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, images.length - 1));
  const src = images[safeIndex] ?? images[0];
  const count = images.length;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < count - 1;

  useEffect(() => {
    if (!open) return;
    setZoomed2x(false);
  }, [open, safeIndex]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && canPrev) {
        e.preventDefault();
        onActiveChange(safeIndex - 1);
      }
      if (e.key === "ArrowRight" && canNext) {
        e.preventDefault();
        onActiveChange(safeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canPrev, canNext, safeIndex, onActiveChange, onClose]);

  const goPrev = useCallback(() => {
    if (canPrev) onActiveChange(safeIndex - 1);
  }, [canPrev, onActiveChange, safeIndex]);

  const goNext = useCallback(() => {
    if (canNext) onActiveChange(safeIndex + 1);
  }, [canNext, onActiveChange, safeIndex]);

  if (!open || !src) return null;

  const navBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-black/70 disabled:pointer-events-none disabled:opacity-25";

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-zinc-950/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Galerie agrandie"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-3 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight text-white" title={productName}>
          {productName}
        </p>
        {count > 1 ? (
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/90">
            {safeIndex + 1} / {count}
          </span>
        ) : null}
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white text-black transition hover:bg-zinc-100"
          onClick={onClose}
          aria-label="Fermer"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-3 sm:px-4 sm:py-5"
        onClick={onClose}
      >
        <div
          className="relative z-10 flex min-h-0 w-full max-w-[min(100vw-1rem,720px)] flex-1 flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {count > 1 ? (
            <button
              type="button"
              className={`${navBtn} absolute left-2 top-1/2 z-30 -translate-y-1/2 sm:left-3`}
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              disabled={!canPrev}
              aria-label="Image précédente"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          {count > 1 ? (
            <button
              type="button"
              className={`${navBtn} absolute right-2 top-1/2 z-30 -translate-y-1/2 sm:right-3`}
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              disabled={!canNext}
              aria-label="Image suivante"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}

          <div
            className="relative flex max-h-[min(88dvh,920px)] w-full flex-1 items-center justify-center"
            onDoubleClick={() => setZoomed2x((z) => !z)}
            role="presentation"
          >
            <div
              className={`relative aspect-[3/4] w-full max-h-full min-h-[200px] rounded-lg sm:rounded-xl ${
                zoomed2x ? "cursor-zoom-out overflow-auto touch-pan-x touch-pan-y" : "cursor-zoom-in overflow-hidden"
              }`}
            >
              <Image
                src={src}
                alt={productName}
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                unoptimized={shouldBypassImageOptimization(src)}
                priority
                className={`object-contain transition-transform duration-300 ease-out motion-reduce:transition-none ${
                  zoomed2x ? "scale-[2]" : "scale-100"
                }`}
                style={{ transformOrigin: "center center" }}
                draggable={false}
              />
            </div>
          </div>
        </div>

        {count > 1 ? (
          <div
            className="mt-2 flex max-w-full gap-1.5 overflow-x-auto px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((thumb, i) => (
              <button
                key={`${thumb}-${i}`}
                type="button"
                onClick={() => onActiveChange(i)}
                aria-label={`Image ${i + 1}`}
                aria-current={i === safeIndex ? "true" : undefined}
                className={`relative h-14 w-11 shrink-0 overflow-hidden rounded-md border-2 transition sm:h-16 sm:w-12 ${
                  i === safeIndex ? "border-white ring-1 ring-white/40" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={thumb}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                  loading="lazy"
                  unoptimized={shouldBypassImageOptimization(thumb)}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
