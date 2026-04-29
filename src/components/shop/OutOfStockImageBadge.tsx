/** Red pill on top of product image (reference: OUT OF STOCK). */
export function OutOfStockImageBadge({
  className = "",
  compact = false,
}: {
  className?: string;
  /** Smaller for gallery thumbnails. */
  compact?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute left-2 top-2 z-[15] max-w-[calc(100%-1rem)] text-left ${className}`}
    >
      <span
        className={
          compact
            ? "inline-block max-w-full truncate rounded-sm bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-tight tracking-wide text-white"
            : "inline-block rounded-sm bg-red-600 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white sm:px-3 sm:text-[11px]"
        }
      >
        {compact ? "OOS" : "OUT OF STOCK"}
      </span>
    </div>
  );
}
