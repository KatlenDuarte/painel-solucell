// Filtro "de uma data até outra" (valores no formato do <input type="date">: AAAA-MM-DD).

export interface DateRange { from: string; to: string }

export const toInputDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parse = (v: string, endOfDay: boolean) => {
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return null;
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
};

/** Início e fim do intervalo (datas invertidas são corrigidas; campo vazio = sem limite). */
export function rangeBounds({ from, to }: DateRange): { start: Date | null; end: Date | null } {
    let start = from ? parse(from, false) : null;
    let end = to ? parse(to, true) : null;
    if (start && end && start > end) {
        start = parse(to, false);
        end = parse(from, true);
    }
    return { start, end };
}

export function inDateRange(date: Date | null | undefined, range: DateRange): boolean {
    if (!date || isNaN(date.getTime())) return false;
    const { start, end } = rangeBounds(range);
    return (!start || date >= start) && (!end || date <= end);
}

/** Texto amigável: "de 01/10/2026 a 15/10/2026". */
export function describeRange(range: DateRange): string {
    const { start, end } = rangeBounds(range);
    const f = (d: Date) => d.toLocaleDateString("pt-BR");
    if (start && end) return start.toDateString() === end.toDateString() ? `em ${f(start)}` : `de ${f(start)} a ${f(end)}`;
    if (start) return `a partir de ${f(start)}`;
    if (end) return `até ${f(end)}`;
    return "em todo o período";
}
