"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ComingSoonProductModal({ open, onClose }: Props) {
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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-product-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-none border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-black"
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
          <h2
            id="coming-soon-product-title"
            className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-black sm:text-base"
          >
            Bientôt disponible
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Ce produit arrive bientôt. Revenez plus tard pour le découvrir.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full bg-black px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
