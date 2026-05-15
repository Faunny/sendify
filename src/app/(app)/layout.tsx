import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { prisma } from "@/lib/db";

// Layout fetches the live nav badge counts on every nav (force-dynamic in the
// child pages already hits Neon; this just piggybacks a 2-query count look-up
// so the sidebar's "Approvals · 14" badge reflects reality instead of the
// hard-coded "2" it used to show.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [approvalsCount, activeFlowsCount] = await Promise.all([
    prisma.campaign.count({ where: { status: "PENDING_APPROVAL" } }).catch(() => 0),
    prisma.flow.count({ where: { active: true } }).catch(() => 0),
  ]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen">
        <Sidebar
          badges={{
            "/approvals": approvalsCount,
            "/flows": activeFlowsCount,
          }}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
