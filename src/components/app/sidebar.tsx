"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  Calendar,
  ClipboardList,
  Inbox,
  FileText,
  Users,
  Workflow,
  ImageIcon,
  BarChart3,
  Filter,
  Settings,
  Languages,
  Boxes,
  Palette,
  Ticket,
  ShieldOff,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Badge } from "@/components/ui/badge";
import { STORES } from "@/lib/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV: { group: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/approvals", label: "Approvals", icon: Inbox, badge: "2" },
    ],
  },
  {
    group: "Send",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Mail },
      { href: "/flows", label: "Flows", icon: Workflow },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    group: "Audience",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/segments", label: "Segments", icon: Filter },
      { href: "/forms", label: "Forms", icon: ClipboardList },
      { href: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    group: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Boxes },
      { href: "/discounts", label: "Discounts", icon: Ticket },
    ],
  },
  {
    group: "Hygiene",
    items: [
      { href: "/suppressions", label: "Suppressions", icon: ShieldOff },
    ],
  },
  {
    group: "Studio",
    items: [
      { href: "/builder", label: "Builder", icon: Palette },
      { href: "/assets", label: "Asset library", icon: ImageIcon },
      { href: "/translations", label: "Translations", icon: Languages },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-60 flex-col border-r border-border bg-[color:var(--bg-elevated)]/60 backdrop-blur-xl sticky top-0">
      <div className="flex h-14 items-center px-4 border-b border-border">
        <Logo />
      </div>

      <div className="px-3 py-3 border-b border-border">
        <StoreSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map((group) => (
          <div key={group.group} className="mb-4">
            <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.group}
            </div>
            <ul className="mt-1 space-y-px">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[14px] transition-colors",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", active && "text-[color:var(--accent)]")} />
                        {item.label}
                      </span>
                      {item.badge && (
                        <Badge variant="accent" className="h-4 px-1.5 text-[11px]">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] transition-colors",
            pathname.startsWith("/settings")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

function StoreSwitcher() {
  const current = STORES[0];
  return (
    <div className="group rounded-lg border border-border bg-card p-2 hover:border-border/80 transition-colors cursor-pointer">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6 rounded-md">
          <AvatarFallback className="rounded-md bg-foreground text-background text-[11px] font-semibold">
            DP
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[13px] font-medium">{current.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{current.shopifyDomain}</div>
        </div>
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      </div>
    </div>
  );
}
