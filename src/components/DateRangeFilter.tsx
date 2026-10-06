// Campos "De" e "Até" para filtrar listas por intervalo de datas.

import { CalendarRange, X } from "lucide-react";
import { toInputDate, type DateRange } from "../lib/dateRange";

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toInputDate(d); };

export default function DateRangeFilter({ value, onChange, className = "" }: {
    value: DateRange;
    onChange: (range: DateRange) => void;
    className?: string;
}) {
    const today = toInputDate(new Date());
    const presets: [string, DateRange][] = [
        ["Ontem", { from: daysAgo(1), to: daysAgo(1) }],
        ["15 dias", { from: daysAgo(14), to: today }],
        ["30 dias", { from: daysAgo(29), to: today }],
        ["90 dias", { from: daysAgo(89), to: today }],
    ];
    return (
        <div className={`flex w-full flex-col gap-2 sm:w-auto ${className}`}>
            <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 sm:flex-none">
                    <span className="mb-1 block text-[11px] font-medium text-fg-subtle">De</span>
                    <input type="date" value={value.from} max={value.to || undefined} onChange={e => onChange({ ...value, from: e.target.value })}
                        className="ui-input w-full sm:w-[160px]" aria-label="Data inicial" />
                </label>
                <label className="min-w-0 flex-1 sm:flex-none">
                    <span className="mb-1 block text-[11px] font-medium text-fg-subtle">Até</span>
                    <input type="date" value={value.to} min={value.from || undefined} onChange={e => onChange({ ...value, to: e.target.value })}
                        className="ui-input w-full sm:w-[160px]" aria-label="Data final" />
                </label>
                {(value.from || value.to) && (
                    <button type="button" onClick={() => onChange({ from: "", to: "" })} title="Limpar datas" aria-label="Limpar datas"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-fg-subtle hover:bg-hover hover:text-fg">
                        <X size={16} />
                    </button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <CalendarRange size={14} className="text-fg-faint" />
                {presets.map(([label, r]) => {
                    const active = value.from === r.from && value.to === r.to;
                    return (
                        <button key={label} type="button" onClick={() => onChange(r)}
                            className={`h-7 rounded-full border px-2.5 text-xs font-medium transition-colors ${active ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:bg-hover"}`}>
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
