"use client";

import { Bell, Search, Sparkles, Command } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
            className="h-9 w-full rounded-md border border-border bg-card px-8 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      <Button variant="outline" size="sm" className="gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent)]" />
        Generate
      </Button>

      <div className="relative">
        <Button variant="ghost" size="icon-sm">
          <Bell className="h-4 w-4" />
        </Button>
        <Badge variant="accent" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full p-0 text-[9px]">3</Badge>
      </div>

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
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Team & roles</DropdownMenuItem>
          <DropdownMenuItem>API keys</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Documentation</DropdownMenuItem>
          <DropdownMenuItem>Changelog</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-[color:var(--danger)]">Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
