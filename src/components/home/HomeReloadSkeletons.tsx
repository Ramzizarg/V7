/** Placeholders shown during reload while catalog API is in flight — reduces layout jump. */

export function CategoryCarouselSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden px-1 sm:px-2" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-[320px] w-[280px] shrink-0 animate-pulse rounded-sm bg-zinc-200"
        />
      ))}
    </div>
  );
}

export function FeaturedProductsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden px-5 sm:px-8" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-[200px] shrink-0 overflow-hidden border border-zinc-200/80 bg-white sm:w-[240px]"
        >
          <div className="aspect-[3/4] w-full animate-pulse bg-zinc-200" />
          <div className="space-y-2 border-t border-zinc-100 p-2.5">
            <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
