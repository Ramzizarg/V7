import { DashboardHeader } from "@/components/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen min-h-screen-dynamic bg-white text-black">
      <DashboardHeader />
      <div className="pt-28 sm:pt-32 px-4 sm:px-6 pb-6">{children}</div>
    </div>
  );
}
