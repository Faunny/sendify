"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, Search, Sparkles, Command } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-[color:var(--bg-elevated)]/70 backdrop-blur-xl px-4 md:px-6">
      <div className="hidden md:flex items-center gap-2 max-w-md flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search campaigns, customers, products…"
            className="h-9 w-full rounded-md border border-border bg-card px-8 text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      {/* Generate: shortcut to AI template gen. Used to be a dead button. */}
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link href="/templates">
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Link>
      </Button>

      {/* Bell: shortcut to /approvals (the only "notification source" today —
          if a draft is waiting that's where it shows up). Hard-coded "3" badge
          dropped; real count lives in the sidebar nav. */}
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href="/approvals" title="Pending approvals">
          <Bell className="h-4 w-4" />
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring/40">
            <Avatar>
              <AvatarFallback>F</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/settings">Profile · Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">Team & API keys</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-[color:var(--danger)]">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
