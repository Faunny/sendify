"use client";

import { useState } from "react";
import { AlertCircle, Check, FileSpreadsheet, Loader2, Upload, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/page-header";
import { STORES } from "@/lib/mock";
import { cn, formatNumber } from "@/lib/utils";

type ProgressUpdate = {
  read: number;
  mapped: number;
  skipped: number;
  inserted: number;
  done: boolean;
  dryRun?: boolean;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [storeId, setStoreId] = useState(STORES[0].id);
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(f: File) {
    setFile(f);
    setProgress(null);
    setError(null);
    // Preview the first ~10 rows to validate the mapping before running.
    const text = await f.slice(0, 32 * 1024).text();
    const lines = text.split(/\r?\n/).slice(0, 11);
    const split = lines.map((line) => parseSimpleCsvLine(line));
    setHeaders(split[0] ?? []);
    setPreview(split.slice(1, 11).filter((r) => r.length > 1));
  }

  async function runImport() {
    if (!file) return;
    setRunning(true);
    setProgress(null);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("storeId", storeId);
    form.append("dryRun", String(dryRun));

    try {
      const res = await fetch("/api/customers/import", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as ProgressUpdate;
            setProgress(ev);
          } catch { /* malformed line, skip */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "import failed");
    } finally {
      setRunning(false);
    }
  }

  const store = STORES.find((s) => s.id === storeId)!;
  const pct = progress && progress.mapped > 0 ? (progress.inserted / progress.mapped) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import customers"
        description="Bulk-import customers from Klaviyo (CSV) into the selected Sendify store. Use the CLI script (npm run import:klaviyo) for the initial 1.5M migration; this UI is for top-ups under 100k rows."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" /> CSV file</CardTitle>
            <CardDescription>Drop a Klaviyo profile export. We auto-map columns by header name (Email, First Name, Country, Email Consent, etc.).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onPickFile(f);
              }}
              className={cn(
                "block aspect-[4/1] rounded-md border-2 border-dashed border-border bg-card/40 grid place-items-center cursor-pointer hover:border-[color:var(--accent)] transition-colors",
                file && "border-[color:var(--accent)] bg-[color-mix(in_oklch,var(--accent)_4%,transparent)]"
              )}
            >
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }} />
              {file ? (
                <div className="text-center">
                  <Check className="h-5 w-5 text-[color:var(--positive)] mx-auto mb-1.5" />
                  <div className="text-[13px] font-medium">{file.name}</div>
                  <div className="text-[11px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · {preview?.length ?? 0} rows previewed</div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
                  <div className="text-[13px]">Drop CSV here or click to browse</div>
                  <div className="text-[11px] text-muted-foreground">UTF-8 · comma- or semicolon-separated · BOM ok</div>
                </div>
              )}
            </label>

            {preview && headers.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview · first {preview.length} rows</div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-card border-b border-border">
                        {headers.slice(0, 8).map((h, i) => (
                          <th key={i} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {row.slice(0, 8).map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 font-mono text-[10px] truncate max-w-[160px]">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Destination</CardTitle>
            <CardDescription>Which Shopify store these customers belong to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div>Default language: <span className="text-foreground">{store.defaultLanguage}</span></div>
              <div>Markets: <span className="text-foreground">{store.markets.slice(0, 5).join(", ")}{store.markets.length > 5 ? "…" : ""}</span></div>
              <div>Current customers: <span className="text-foreground tabular-nums">{formatNumber(store.customers)}</span></div>
            </div>

            <label className="flex items-center justify-between rounded-md border border-border bg-card/40 p-2.5 mt-4">
              <div>
                <div className="text-[12px] font-medium">Dry run</div>
                <div className="text-[10px] text-muted-foreground">Parse + map without writing to DB</div>
              </div>
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
            </label>

            <Button onClick={runImport} disabled={!file || running} className="w-full mt-2">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dryRun ? <Zap className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {running ? "Running…" : dryRun ? "Dry-run" : "Import for real"}
            </Button>

            {error && (
              <div className="rounded-md border border-[color:var(--danger)]/40 bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] p-2.5 text-[11px] text-[color:var(--danger)] flex items-start gap-2">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {progress.done
                ? <Check className="h-3.5 w-3.5 text-[color:var(--positive)]" />
                : <span className="relative inline-flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
                  </span>}
              {progress.done ? "Import complete" : "Importing…"}
              {progress.dryRun && progress.done && <Badge variant="warning">Dry-run · nothing written</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Stat label="Rows read"  value={formatNumber(progress.read)}    />
              <Stat label="Mapped"     value={formatNumber(progress.mapped)}  tone="positive" />
              <Stat label="Skipped"    value={formatNumber(progress.skipped)} tone={progress.skipped > 0 ? "warning" : undefined} />
              <Stat label={dryRun ? "Would insert" : "Inserted (deduped)"} value={formatNumber(progress.inserted)} tone="accent" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How to export from Klaviyo</CardTitle>
          <CardDescription>1-time export for the initial 1.5M migration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-[12px] text-muted-foreground">
          <ol className="space-y-1.5 list-decimal pl-5">
            <li>Klaviyo dashboard → <span className="text-foreground">Profiles</span></li>
            <li>Filter: <span className="text-foreground font-mono">Email Consent = subscribed OR unsubscribed</span> (skip never-subscribed if you want to start clean)</li>
            <li>Click <span className="text-foreground">Export</span> → CSV → All columns</li>
            <li>For ≥100k rows: don't upload here. Run <span className="text-foreground font-mono bg-muted px-1 rounded">npm run import:klaviyo -- --csv path.csv --store {storeId}</span> from your laptop</li>
            <li>For each Shopify store run a separate export filtered to that store's list memberships</li>
          </ol>
          <div className="rounded-md border border-border bg-card/40 p-2.5 mt-3 text-[11px]">
            <span className="text-foreground font-medium">Columns we auto-map:</span> Email, First Name, Last Name, Phone Number, Country, Locale, Email Consent, Suppressions, Historic Number of Orders, Historic Customer Lifetime Value, Lists, Tags.<br />
            <span className="text-foreground font-medium">Consent inference:</span> Suppressions column wins (bounce → BOUNCED, spam → COMPLAINED). Otherwise Email Consent maps directly.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "accent" | "warning" }) {
  const color =
    tone === "positive" ? "var(--positive)" :
    tone === "accent"   ? "var(--accent)" :
    tone === "warning"  ? "var(--warning)" : undefined;
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[18px] font-medium tabular-nums" style={color ? { color: `color-mix(in oklch, ${color} 90%, var(--fg))` } : undefined}>
        {value}
      </div>
    </div>
  );
}

// Minimal CSV line splitter for the preview (handles quotes, no escapes).
// The real import uses csv-parse server-side with full RFC4180 handling.
function parseSimpleCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && (c === "," || c === ";")) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
