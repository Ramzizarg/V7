import { DashboardHeader } from "@/components/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen min-h-screen-dynamic bg-white text-black">
      <DashboardHeader />
      <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
        <form action="/api/backoffice/logout" method="POST">
          <button
            type="submit"
            className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-black transition hover:bg-zinc-100"
          >
            Deconnexion
          </button>
        </form>
      </div>
      <div className="pt-20 sm:pt-24 px-4 sm:px-6 pb-6">
        {children}
      </div>
    </div>
  );
}
