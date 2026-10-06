// src/components/ui/index.tsx
// Componentes base do design system. Todas as telas devem usar estes blocos
// para manter o mesmo espaçamento, tipografia e cores nos dois temas.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Page */

export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
    return <div className={cx("px-4 py-5 sm:px-6 lg:px-10 lg:py-9 mx-auto w-full space-y-5 lg:space-y-6", narrow ? "max-w-4xl" : "max-w-[1400px]", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, meta }: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    meta?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-fg leading-tight">{title}</h1>
                {description && <p className="mt-1.5 text-sm text-fg-subtle max-w-2xl">{description}</p>}
                {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
        </div>
    );
}

/* ------------------------------------------------------------------ Card */

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
    return (
        <div className={cx("rounded-2xl border border-line bg-surface shadow-[var(--ui-shadow)]", padded && "p-5 sm:p-6", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ title, description, action, icon: Icon, className }: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    icon?: LucideIcon;
    className?: string;
}) {
    return (
        <div className={cx("flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line", className)}>
            <div className="flex items-start gap-3 min-w-0">
                {Icon && (
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle text-fg-subtle">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
                    {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

/* ------------------------------------------------------------------ Tones */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const toneSoft: Record<Tone, string> = {
    neutral: "bg-subtle text-fg-muted border-line",
    primary: "bg-primary-soft text-primary-text border-transparent",
    success: "bg-success-soft text-success border-transparent",
    warning: "bg-warning-soft text-warning border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
    info: "bg-info-soft text-info border-transparent",
};


export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", toneSoft[tone], className)}>
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------ Stat */

const toneIcon: Record<Tone, string> = {
    neutral: "text-fg-subtle", primary: "text-primary-text", success: "text-success",
    warning: "text-warning", danger: "text-danger", info: "text-info",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", onClick, active, className }: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: Tone;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}) {
    const Comp = onClick ? "button" : "div";
    return (
        <Comp
            onClick={onClick}
            className={cx(
                "group relative overflow-hidden text-left rounded-2xl border bg-surface p-4 sm:p-5 shadow-[var(--ui-shadow)] transition-all",
                active ? "border-primary/50 ring-[3px] ring-primary/10" : "border-line",
                onClick && !active && "hover:border-line-strong hover:-translate-y-px",
                className
            )}
        >
            <div className="flex items-start gap-3">
                {Icon && (
                    <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle">
                        <Icon className={cx("h-5 w-5", toneIcon[tone])} />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg-subtle">
                        {Icon && <Icon className={cx("sm:hidden h-3.5 w-3.5", toneIcon[tone])} />}
                        <span className="truncate">{label}</span>
                    </div>
                    <div className="mt-1 text-lg sm:text-2xl font-bold tracking-tight text-fg tabular truncate">{value}</div>
                    {hint && <div className="mt-0.5 text-xs text-fg-subtle line-clamp-2">{hint}</div>}
                </div>
            </div>
        </Comp>
    );
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const buttonVariant: Record<ButtonVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover border-transparent shadow-[var(--ui-shadow)]",
    secondary: "bg-surface text-fg border-line hover:bg-hover shadow-[var(--ui-shadow)]",
    ghost: "bg-transparent text-fg-muted border-transparent hover:bg-hover hover:text-fg",
    danger: "bg-surface text-danger border-line hover:bg-danger-soft",
    success: "bg-success text-white border-transparent hover:opacity-90",
};

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, children, className, ...props }:
    ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
        size?: "sm" | "md" | "lg";
        icon?: LucideIcon;
        loading?: boolean;
    }) {
    const sizes = { sm: "h-8 px-3 text-xs gap-1.5 rounded-lg", md: "h-10 px-4 text-sm gap-2 rounded-xl", lg: "h-12 px-5 text-[15px] gap-2 rounded-xl" };
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cx(
                "inline-flex items-center justify-center border font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px",
                sizes[size],
                buttonVariant[variant],
                className
            )}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
            {children}
        </button>
    );
}

export function IconButton({ icon: Icon, label, tone, className, ...props }:
    ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: "danger" | "success" | "primary" }) {
    const hover = tone === "danger" ? "hover:text-danger hover:bg-danger-soft"
        : tone === "success" ? "hover:text-success hover:bg-success-soft"
            : tone === "primary" ? "hover:text-primary-text hover:bg-primary-soft"
                : "hover:text-fg hover:bg-hover";
    return (
        <button
            {...props}
            title={label}
            aria-label={label}
            className={cx("inline-flex h-9 w-9 items-center justify-center rounded-xl text-fg-subtle transition-colors disabled:opacity-40", hover, className)}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

/* ------------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({ options, value, onChange, className }: {
    options: { value: T; label: ReactNode }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div className={cx("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-subtle p-1", className)}>
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cx(
                        "h-8 px-3 sm:px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-1 sm:flex-none",
                        value === opt.value
                            ? "bg-surface text-fg shadow-[var(--ui-shadow)] border border-line"
                            : "text-fg-subtle hover:text-fg border border-transparent"
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ Search */

export function SearchInput({ value, onChange, placeholder, className, icon: Icon }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    icon: LucideIcon;
}) {
    return (
        <div className={cx("relative", className)}>
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="ui-input pl-9"
            />
        </div>
    );
}

/* ------------------------------------------------------------------ Empty / Loading */

export function EmptyState({ icon: Icon, title, description, action, className }: {
    icon: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx("flex flex-col items-center justify-center text-center px-6 py-14", className)}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-subtle text-fg-subtle">
                <Icon className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-fg">{title}</p>
            {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-fg-subtle">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            {label}
        </div>
    );
}

/* ------------------------------------------------------------------ Progress */

export function Meter({ value, max, tone = "primary" }: { value: number; max: number; tone?: Tone }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const bar: Record<Tone, string> = {
        neutral: "bg-fg-faint", primary: "bg-primary", success: "bg-success",
        warning: "bg-warning", danger: "bg-danger", info: "bg-info",
    };
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle border border-line/60">
            <div className={cx("h-full rounded-full transition-all", bar[tone])} style={{ width: `${pct}%` }} />
        </div>
    );
}

/* ------------------------------------------------------------------ Mobile list */

/** Linha de lista usada no lugar das tabelas em telas pequenas. */
export function ListRow({ title, subtitle, meta, value, actions, leading, className }: {
    title: ReactNode;
    subtitle?: ReactNode;
    meta?: ReactNode;
    value?: ReactNode;
    actions?: ReactNode;
    leading?: ReactNode;
    className?: string;
}) {
    return (
        <li className={cx("flex gap-3 px-4 py-3.5", className)}>
            {leading}
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm font-medium text-fg">{title}</div>
                    {value && <div className="shrink-0 text-sm font-bold text-fg tabular">{value}</div>}
                </div>
                {subtitle && <div className="mt-0.5 text-xs text-fg-subtle">{subtitle}</div>}
                {(meta || actions) && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">{meta}</div>
                        {actions && <div className="flex shrink-0 items-center -mr-1.5">{actions}</div>}
                    </div>
                )}
            </div>
        </li>
    );
}
