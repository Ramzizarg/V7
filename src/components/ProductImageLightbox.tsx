"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { shouldBypassImageOptimization } from "@/lib/imageOptimize";
import {
  PRODUCT_GALLERY_SIZES,
  preloadProductGalleryImage,
  preloadProductGalleryImages,
} from "@/lib/productGallery";

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
  const count = images.length;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < count - 1;

  useEffect(() => {
    if (!open) return;
    preloadProductGalleryImages(images);
  }, [open, images]);

  useEffect(() => {
    if (!open) return;
    preloadProductGalleryImage(images[safeIndex + 1] ?? "");
    preloadProductGalleryImage(images[safeIndex - 1] ?? "");
  }, [open, safeIndex, images]);

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

  if (!open || count === 0) return null;

  const navBtn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-black/75 disabled:pointer-events-none disabled:opacity-25";

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-zinc-950/96 backdrop-blur-md"
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

      <div className="relative flex min-h-0 flex-1 flex-col" onClick={onClose}>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-3 sm:px-6 sm:py-4"
          onClick={(e) => e.stopPropagation()}
        >
          {count > 1 ? (
            <button
              type="button"
              className={`${navBtn} absolute left-2 top-1/2 z-30 -translate-y-1/2 sm:left-4`}
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
              className={`${navBtn} absolute right-2 top-1/2 z-30 -translate-y-1/2 sm:right-4`}
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
            className={`relative flex h-full w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl ${
              zoomed2x ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            onDoubleClick={() => setZoomed2x((z) => !z)}
            role="presentation"
          >
            <div
              className={`relative h-full w-full max-h-full transition-transform duration-200 ease-out ${
                zoomed2x ? "origin-center scale-[1.85] overflow-auto touch-pan-x touch-pan-y" : ""
              }`}
            >
              {images.map((imgSrc, i) => {
                const isActive = i === safeIndex;
                return (
                  <Image
                    key={`lightbox-${imgSrc}-${i}`}
                    src={imgSrc}
                    alt={isActive ? productName : ""}
                    fill
                    sizes={PRODUCT_GALLERY_SIZES}
                    unoptimized={shouldBypassImageOptimization(imgSrc)}
                    priority={i === 0}
                    loading="eager"
                    fetchPriority={isActive ? "high" : i < 3 ? "auto" : "low"}
                    aria-hidden={!isActive}
                    className={`object-contain object-center transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                      isActive
                        ? "z-[1] opacity-100"
                        : "pointer-events-none z-0 opacity-0"
                    }`}
                    draggable={false}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {count > 1 ? (
          <div
            className="flex shrink-0 justify-center border-t border-white/10 bg-black/30 px-3 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-white/10 px-2 py-1.5 [scrollbar-width:none] sm:gap-2.5 sm:px-2.5 sm:py-2 [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Miniatures"
            >
              {images.map((thumb, i) => {
                const isActive = i === safeIndex;
                return (
                  <button
                    key={`${thumb}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onActiveChange(i)}
                    onPointerEnter={() => preloadProductGalleryImage(thumb)}
                    onFocus={() => preloadProductGalleryImage(thumb)}
                    aria-label={`Image ${i + 1}`}
                    className={`shrink-0 rounded-[9px] border-2 p-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                      isActive
                        ? "border-white bg-white"
                        : "border-transparent bg-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="relative block h-11 w-9 overflow-hidden rounded-[7px] bg-zinc-800 sm:h-12 sm:w-10">
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover object-center"
                        loading="lazy"
                        unoptimized={shouldBypassImageOptimization(thumb)}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
