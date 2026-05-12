import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-app grid place-items-center px-6">
      <div className="text-center space-y-6 max-w-sm">
        <Logo className="justify-center" />
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Page not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">The link you followed doesn't exist or has been moved.</p>
        </div>
        <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
