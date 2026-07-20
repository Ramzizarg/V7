"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "@/i18n/SiteLocaleProvider";

const SHOW_AFTER_PX = 420;
/** Black V7 on white — CSS invert → white V7 on black (blends into the circle). */
const LOGO_SRC = "/vero7-logo.webp";

function UpArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export default function BackToTopButton() {
  const { t, locale } = useTranslations();
  const pathId = useId().replace(/:/g, "");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ringText =
    locale === "fr"
      ? "HAUT DE PAGE • HAUT DE PAGE • HAUT DE PAGE • "
      : "BACK TO TOP • BACK TO TOP • BACK TO TOP • ";

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t("home.backToTop")}
      className={`vero7-back-to-top group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[90] flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full transition-[opacity,transform,visibility] duration-300 ease-out sm:bottom-8 sm:right-7 sm:h-[5.5rem] sm:w-[5.5rem] ${
        visible
          ? "pointer-events-auto visible translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-3 opacity-0"
      }`}
    >
      <svg
        className="vero7-back-to-top__ring pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <defs>
          <path
            id={pathId}
            fill="none"
            d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
          />
        </defs>
        <text
          fill="#52525b"
          fontSize="7.2"
          fontWeight="500"
          letterSpacing="1.6"
          style={{ textTransform: "uppercase" }}
        >
          <textPath href={`#${pathId}`} startOffset="0%">
            {ringText}
          </textPath>
        </text>
      </svg>

      <span className="relative z-[1] flex h-[58%] w-[58%] items-center justify-center overflow-hidden rounded-full bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform duration-300 group-hover:scale-105">
        {/* invert only: black V7 → white, white bg → black (no white square) */}
        <Image
          src={LOGO_SRC}
          alt=""
          width={56}
          height={56}
          className="h-[70%] w-[70%] object-contain invert transition-opacity duration-200 group-hover:opacity-0"
          aria-hidden
        />
        <UpArrowIcon className="absolute h-[42%] w-[42%] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </span>
    </button>
  );
}
