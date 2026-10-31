"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";

type Point = { day: string; inbound: number; success: number; failed: number };

// ตรวจสอบด้วย dataviz validator แล้ว (all-pairs CVD ΔE ≥ 8.9) — เขียวมี contrast ต่ำ จึงมี legend + มุมมองตาราง
const SERIES = [
  { key: "inbound", label: "ข้อความเข้า", color: "#2a78d6" },
  { key: "success", label: "ตอบกลับสำเร็จ", color: "#06c755" },
  { key: "failed", label: "ตอบกลับไม่สำเร็จ", color: "#e34948" },
] as const;

function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{dayLabel(label)}</p>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <div key={s.key} className="flex items-center gap-2 py-0.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">{formatNumber(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DailyChart({ data }: { data: Point[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4" aria-label="คำอธิบายกราฟ">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setView(view === "chart" ? "table" : "chart")}>
          {view === "chart" ? <Table2 /> : <BarChart3 />}
          {view === "chart" ? "ดูแบบตาราง" : "ดูแบบกราฟ"}
        </Button>
      </div>
      {view === "chart" ? (
        <div className="h-64 w-full" role="img" aria-label="กราฟสถิติข้อความรายวัน 14 วันล่าสุด">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#eef0f2" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={dayLabel}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                {SERIES.map((s) => (
                  <TableHead key={s.key} className="text-right">{s.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data].reverse().map((p) => (
                <TableRow key={p.day}>
                  <TableCell>{dayLabel(p.day)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.inbound)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.success)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.failed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
