// src/lib/format.ts — formatadores compartilhados

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (value: number | null | undefined) => brl.format(Number(value) || 0);

export const formatDate = (d?: Date | null) =>
    d ? d.toLocaleDateString("pt-BR") : "—";

export const formatTime = (d?: Date | null) =>
    d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

export const formatDateTime = (d?: Date | null) =>
    d ? `${formatDate(d)} · ${formatTime(d)}` : "—";

/** Iniciais para avatares ("Maria Souza" -> "MS") */
export const initials = (name?: string | null) =>
    (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(p => p.charAt(0).toUpperCase())
        .join("") || "?";
