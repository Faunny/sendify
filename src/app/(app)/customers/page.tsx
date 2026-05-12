import Link from "next/link";
import { Download, Filter, Plus, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { STORES, makeCustomers } from "@/lib/mock";
import { LANGUAGES, languageByCode } from "@/lib/languages";
import { formatCurrency } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "positive" | "muted" | "danger" | "warning"> = {
  SUBSCRIBED: "positive",
  UNSUBSCRIBED: "muted",
  PENDING: "warning",
  BOUNCED: "danger",
};

export default function CustomersPage() {
  const customers = makeCustomers(40);
  const totalCustomers = STORES.reduce((s, x) => s + x.customers, 0);
  const totalSubscribed = STORES.reduce((s, x) => s + x.subscribed, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Synced from Shopify in real-time. Language, country, app state and consent flow into every segment automatically."
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Import</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total customers" value={totalCustomers.toLocaleString()} hint="across 4 stores" />
        <StatCard label="Subscribed" value={totalSubscribed.toLocaleString()} hint={`${((totalSubscribed / totalCustomers) * 100).toFixed(1)}% of total`} />
        <StatCard label="Has app installed" value="127,820" hint="from Shopify metafield" />
        <StatCard label="Languages tracked" value={`${LANGUAGES.length}`} hint="BCP-47, ISO-3166-1" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search email, name, Shopify ID…" className="pl-8" />
        </div>
        <Button variant="ghost" size="sm"><Filter className="h-3.5 w-3.5" /> All stores</Button>
        <Button variant="ghost" size="sm">All languages</Button>
        <Button variant="ghost" size="sm">All consent</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-5 py-2.5">Customer</th>
                <th className="text-left font-medium px-3 py-2.5">Store</th>
                <th className="text-left font-medium px-3 py-2.5">Language</th>
                <th className="text-left font-medium px-3 py-2.5">Country</th>
                <th className="text-left font-medium px-3 py-2.5">Consent</th>
                <th className="text-center font-medium px-3 py-2.5">App</th>
                <th className="text-right font-medium px-3 py-2.5">Orders</th>
                <th className="text-right font-medium px-5 py-2.5">Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 30).map((c) => {
                const store = STORES.find((s) => s.id === c.storeId)!;
                const lang = languageByCode(c.language);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer">
                    <td className="px-5 py-2.5">
                      <Link href={`/customers/${c.id}`} className="block">
                        <div className="text-[13px] font-medium hover:text-[color:var(--accent)]">{c.firstName} {c.lastName}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">{c.email}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{store.name.replace("Divain ", "")}</td>
                    <td className="px-3 py-2.5 text-[12px]">{lang?.flag} {lang?.code}</td>
                    <td className="px-3 py-2.5 text-[12px]">{c.country}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_VARIANT[c.consentStatus]}>{c.consentStatus.toLowerCase()}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.hasApp ? <Smartphone className="h-3.5 w-3.5 inline text-[color:var(--accent)]" /> : <span className="text-muted-foreground text-[10px]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">{c.ordersCount}</td>
                    <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(c.totalSpent, store.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-medium tracking-tight tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </Card>
  );
}
