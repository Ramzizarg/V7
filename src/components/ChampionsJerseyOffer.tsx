"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  CHAMPIONS_JERSEY_OFFER_ENDS_AT,
  CHAMPIONS_JERSEY_SALE_PRICE,
  isChampionsJerseyFlashSaleActive,
  remainingOfferMs,
} from "@/lib/specialOffers";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function splitRemaining(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function formatDt(amount: number) {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",");
  return `${rounded} د.ت`;
}

export function useChampionsJerseyFlashSale(productId?: number) {
  const [now, setNow] = useState<number | null>(null);
  const matchesProduct = productId == null || productId === 1;
  useEffect(() => {
    if (!matchesProduct) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [matchesProduct]);
  const clock = now ?? Date.now();
  const active = matchesProduct && isChampionsJerseyFlashSaleActive(clock);
  return {
    active,
    now: clock,
    remainingMs: now == null ? 0 : remainingOfferMs(now),
    ready: now != null,
    endsAt: CHAMPIONS_JERSEY_OFFER_ENDS_AT,
  };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <span className="text-[1.45rem] font-black tabular-nums leading-none tracking-tight text-black sm:text-[1.6rem]" dir="ltr">
        {pad2(value)}
      </span>
      <span className="mt-1.5 text-[10px] font-medium leading-none text-zinc-500">{label}</span>
    </div>
  );
}

function Colon() {
  return (
    <span className="select-none self-start pt-0.5 text-lg font-black leading-none text-zinc-300" aria-hidden>
      :
    </span>
  );
}

export function OfferCountdown({ compact }: { compact?: boolean }) {
  const { remainingMs, active, ready } = useChampionsJerseyFlashSale();
  if (!active) return null;
  const parts = ready ? splitRemaining(remainingMs) : { days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (compact) {
    return (
      <p className="font-semibold tabular-nums text-black" dir="ltr">
        {pad2(parts.days)}:{pad2(parts.hours)}:{pad2(parts.minutes)}:{pad2(parts.seconds)}
      </p>
    );
  }
  return (
    <div
      className="flex items-start justify-between gap-1"
      role="timer"
      aria-live="polite"
      aria-label="ينتهي العرض بعد"
      dir="ltr"
    >
      <CountdownUnit value={parts.days} label="يوم" />
      <Colon />
      <CountdownUnit value={parts.hours} label="ساعة" />
      <Colon />
      <CountdownUnit value={parts.minutes} label="دقيقة" />
      <Colon />
      <CountdownUnit value={parts.seconds} label="ثانية" />
    </div>
  );
}

export function ChampionsJerseyOfferCard({ compareAt }: { compareAt: number }) {
  const { active } = useChampionsJerseyFlashSale(1);
  if (!active) return null;

  const saved = Math.max(0, Math.round(compareAt - CHAMPIONS_JERSEY_SALE_PRICE));

  return (
    <aside lang="ar" dir="rtl" className="font-arabic mt-5 border border-black bg-white">
      <div className="bg-red-600 px-4 py-1.5 text-center text-[11px] font-bold tracking-wide text-white">
        عرض 72 ساعة
      </div>

      <div className="px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500">السعر الكل في الكل</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[2.35rem] font-black leading-none tabular-nums tracking-tight text-black">
                {formatDt(CHAMPIONS_JERSEY_SALE_PRICE)}
              </span>
              {compareAt > CHAMPIONS_JERSEY_SALE_PRICE ? (
                <span className="text-[15px] text-zinc-400 line-through tabular-nums">{formatDt(compareAt)}</span>
              ) : null}
            </div>
          </div>
          {saved > 0 ? (
            <span className="mb-0.5 bg-red-600 px-2 py-1 text-[12px] font-bold text-white">
              وفّرت {formatDt(saved)}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[14px] font-semibold leading-relaxed text-black">
          تأهّل الإفريقي لدوري الأبطال
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-zinc-600">
          <Truck className="h-3.5 w-3.5 shrink-0 text-black" strokeWidth={2.2} aria-hidden />
          توصيل مجاني لباب الدار — كامل تونس
        </p>

        <div className="mt-4 border-t border-black pt-3">
          <p className="mb-2 text-center text-[11px] font-semibold text-zinc-500">ينتهي العرض خلال</p>
          <OfferCountdown />
        </div>
      </div>
    </aside>
  );
}

export function FlashSaleBadge({ className = "" }: { className?: string }) {
  const { active } = useChampionsJerseyFlashSale(1);
  if (!active) return null;
  return (
    <span
      lang="ar"
      dir="rtl"
      className={`font-arabic inline-flex items-center rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white shadow-md ${className}`}
    >
      عرض 72 ساعة
    </span>
  );
}
