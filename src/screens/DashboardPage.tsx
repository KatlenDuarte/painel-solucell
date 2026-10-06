// src/screens/DashboardPage.tsx
import { useState, useMemo } from "react";
import type { Timestamp } from "../lib/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

// Cores calmas e distintas para cada forma de pagamento
const MIX_COLORS: Record<string, string> = { PIX: "#2a9d8f", "Cartão": "#5b7bd5", Dinheiro: "#c9a24a", Fiado: "#d9707f" };
import {
    Wallet, Receipt, BookOpenText, PackageX, CalendarDays, TrendingUp, ShoppingBag, Users, PackageCheck,
} from "lucide-react";
import { useStoreData } from "../contexts/StoreDataContext";
import { Page, PageHeader, Card, CardHeader, StatCard, Segmented, EmptyState, LoadingState, Badge } from "../components/ui";
import { formatBRL, formatDate, formatTime, initials } from "../lib/format";

interface Product {
    id: string;
    name: string;
    brand?: string;
    stock: number;
    minStock?: number;
}

interface SaleItem {
    name?: string;
    saleQty?: number;
    quantity?: number;
    price?: number;
    total?: number;
}

interface Sale {
    id: string;
    clientName?: string;
    fiado?: { nome?: string };
    timestamp?: Timestamp;
    total: number;
    status?: string;
    type?: string;
    paymentMethod?: string;
    payments?: { pix?: number; cartao?: number; dinheiro?: number };
    multiplePayments?: { method?: string; value?: number }[];
    items?: SaleItem[];
}

type Period = "today" | "7d" | "month" | "all";

const PERIOD_LABEL: Record<Period, string> = {
    today: "hoje",
    "7d": "nos últimos 7 dias",
    month: "neste mês",
    all: "em todo o histórico",
};

const isCountable = (s: Sale) =>
    s.status !== "refunded" && s.status !== "cancelled" && s.type !== "perda";

const isPendingFiado = (s: Sale) =>
    s.status === "pending" && (s.paymentMethod === "Fiado" || !!s.fiado);

export default function DashboardPage() {
    const { products: productDocs, sales: salesDocs, productsLoading, salesLoading } = useStoreData();
    const loading = productsLoading || salesLoading;

    const [period, setPeriod] = useState<Period>("today");
    const [selectedDate, setSelectedDate] = useState<string>("");

    // Dados em tempo real pelo listener compartilhado (StoreDataContext).
    const products = useMemo(
        () => productDocs.map(doc => ({ id: doc.id, ...doc.data() } as Product)),
        [productDocs]
    );
    const sales = useMemo(
        () => salesDocs
            .map(doc => ({ id: doc.id, ...doc.data(), total: Number(doc.data().total) || 0 } as Sale))
            .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)),
        [salesDocs]
    );

    const stats = useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        if (selectedDate) {
            const [y, m, d] = selectedDate.split("-").map(Number);
            start = new Date(y, m - 1, d);
            end = new Date(y, m - 1, d + 1);
        } else if (period === "today") {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === "7d") {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        } else if (period === "month") {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const inPeriod = sales.filter(s => {
            const d = s.timestamp?.toDate();
            if (!d) return period === "all" && !selectedDate;
            return (!start || d >= start) && (!end || d < end);
        });

        const valid = inPeriod.filter(isCountable);
        const revenue = valid.reduce((acc, s) => acc + s.total, 0);

        // Mix de pagamentos
        const mix = { PIX: 0, Cartão: 0, Dinheiro: 0, Fiado: 0 };
        valid.forEach(s => {
            const m = s.paymentMethod;
            if (m === "PIX") mix.PIX += s.total;
            else if (m === "Cartão") mix.Cartão += s.total;
            else if (m === "Dinheiro") mix.Dinheiro += s.total;
            else if (m === "Fiado" || m === "Fiado (Quitado)") mix.Fiado += s.total;
            else if (Array.isArray(s.multiplePayments) && s.multiplePayments.length) {
                s.multiplePayments.forEach(p => {
                    const k = String(p?.method || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                    if (k.includes("PIX")) mix.PIX += Number(p.value) || 0;
                    else if (k.includes("CARTAO")) mix.Cartão += Number(p.value) || 0;
                    else if (k.includes("DINHEIRO")) mix.Dinheiro += Number(p.value) || 0;
                });
            }
            else if (s.payments) {
                mix.PIX += Number(s.payments.pix) || 0;
                mix.Cartão += Number(s.payments.cartao) || 0;
                mix.Dinheiro += Number(s.payments.dinheiro) || 0;
            }
        });

        // Mais vendidos
        const byProduct: Record<string, { qty: number; total: number }> = {};
        valid.forEach(s => (Array.isArray(s.items) ? s.items : []).forEach(it => {
            const name = it.name || "Item";
            const qty = Number(it.saleQty ?? it.quantity ?? 1) || 1;
            const total = Number(it.total ?? (Number(it.price) || 0) * qty) || 0;
            byProduct[name] = byProduct[name] || { qty: 0, total: 0 };
            byProduct[name].qty += qty;
            byProduct[name].total += total;
        }));
        const topProducts = Object.entries(byProduct)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        const pendingFiados = sales.filter(isPendingFiado);
        const lowStock = products
            .filter(p => Number(p.stock) <= (Number(p.minStock) || 5))
            .sort((a, b) => Number(a.stock) - Number(b.stock));

        return {
            revenue,
            count: valid.length,
            ticket: valid.length ? revenue / valid.length : 0,
            mix,
            topProducts,
            recent: valid.slice(0, 6),
            pendingFiados,
            pendingTotal: pendingFiados.reduce((acc, s) => acc + s.total, 0),
            lowStock,
        };
    }, [sales, products, period, selectedDate]);

    // Faturamento dos últimos 14 dias (independente do filtro)
    const chartData = useMemo(() => {
        const days: { key: string; label: string; total: number }[] = [];
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            days.push({
                key: d.toDateString(),
                label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                total: 0,
            });
        }
        const index = new Map(days.map((d, i) => [d.key, i]));
        sales.forEach(s => {
            if (!isCountable(s)) return;
            const d = s.timestamp?.toDate();
            if (!d) return;
            const i = index.get(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString());
            if (i !== undefined) days[i].total += s.total;
        });
        return days;
    }, [sales]);

    const chartTotal = chartData.reduce((acc, d) => acc + d.total, 0);
    const periodLabel = selectedDate ? `em ${formatDate(new Date(selectedDate + "T12:00:00"))}` : PERIOD_LABEL[period];
    const mixTotal = Object.values(stats.mix).reduce((a, b) => a + b, 0);

    if (loading) return <LoadingState label="Carregando indicadores..." />;

    return (
        <Page>
            <PageHeader
                title="Visão geral"
                description={`Desempenho da loja ${periodLabel}.`}
                actions={
                    <>
                        <Segmented
                            value={selectedDate ? ("" as Period) : period}
                            onChange={v => { setPeriod(v); setSelectedDate(""); }}
                            options={[
                                { value: "today", label: "Hoje" },
                                { value: "7d", label: "7 dias" },
                                { value: "month", label: "Mês" },
                                { value: "all", label: "Tudo" },
                            ]}
                        />
                        <label className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="ui-input pl-9 w-[170px]"
                                aria-label="Filtrar por data"
                            />
                        </label>
                    </>
                }
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Faturamento" value={formatBRL(stats.revenue)} icon={Wallet} tone="primary"
                    hint={`${stats.count} ${stats.count === 1 ? "venda" : "vendas"} ${periodLabel}`} />
                <StatCard label="Ticket médio" value={formatBRL(stats.ticket)} icon={Receipt} tone="info"
                    hint="Valor médio por venda" />
                <StatCard label="Fiado em aberto" value={formatBRL(stats.pendingTotal)} icon={BookOpenText} tone="danger"
                    hint={`${stats.pendingFiados.length} ${stats.pendingFiados.length === 1 ? "cliente" : "registros"} a receber`} />
                <StatCard label="Estoque baixo" value={stats.lowStock.length} icon={PackageX} tone="warning"
                    hint={stats.lowStock.length ? "Produtos no mínimo ou abaixo" : "Nenhum produto crítico"} />
            </div>

            {/* Gráfico + Pagamentos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card padded={false} className="xl:col-span-2">
                    <CardHeader
                        title="Faturamento diário"
                        description="Últimos 14 dias"
                        action={<span className="text-sm font-semibold text-fg tabular">{formatBRL(chartTotal)}</span>}
                    />
                    <div className="h-[260px] px-3 pt-4 pb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                                <CartesianGrid vertical={false} stroke="var(--ui-line)" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--ui-fg-subtle)", fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--ui-fg-subtle)", fontSize: 11 }}
                                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v)} />
                                <Tooltip
                                    cursor={{ fill: "var(--ui-hover)" }}
                                    contentStyle={{ background: "var(--ui-surface)", border: "1px solid var(--ui-line)", borderRadius: 8, fontSize: 12, boxShadow: "var(--ui-shadow-lg)" }}
                                    labelStyle={{ color: "var(--ui-fg-subtle)", marginBottom: 2 }}
                                    itemStyle={{ color: "var(--ui-fg)" }}
                                    formatter={(v) => [formatBRL(Number(v)), "Faturamento"]}
                                />
                                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    {chartData.map((_, i) => <Cell key={i} fill="var(--ui-primary)" fillOpacity={i === chartData.length - 1 ? 1 : 0.4} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padded={false}>
                    <CardHeader title="Formas de pagamento" description={`Distribuição ${periodLabel}`} />
                    <div className="p-5 space-y-4">
                        {mixTotal === 0 ? (
                            <EmptyState icon={Wallet} title="Sem recebimentos" description="Nenhuma venda registrada no período." className="py-6" />
                        ) : (
                            (Object.entries(stats.mix) as [string, number][]).map(([method, value]) => (
                                <div key={method} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-fg-muted"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: MIX_COLORS[method] ?? "var(--ui-fg-faint)" }} />{method}</span>
                                        <span className="font-medium text-fg tabular">
                                            {formatBRL(value)}
                                            <span className="ml-2 text-xs font-normal text-fg-subtle">
                                                {mixTotal ? Math.round((value / mixTotal) * 100) : 0}%
                                            </span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${mixTotal ? (value / mixTotal) * 100 : 0}%`, background: MIX_COLORS[method] ?? "var(--ui-fg-faint)" }} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Mais vendidos + Últimas vendas */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card padded={false}>
                    <CardHeader title="Mais vendidos" description={`Por quantidade ${periodLabel}`} icon={TrendingUp} />
                    {stats.topProducts.length === 0 ? (
                        <EmptyState icon={ShoppingBag} title="Nenhum item vendido" description="Os produtos mais vendidos aparecem aqui." />
                    ) : (
                        <ul className="divide-y divide-line">
                            {stats.topProducts.map((p, i) => (
                                <li key={p.name} className="flex items-center gap-3 px-5 py-3">
                                    <span className="w-5 text-xs font-medium text-fg-faint tabular">{i + 1}</span>
                                    <span className="flex-1 min-w-0 truncate text-sm text-fg">{p.name}</span>
                                    <span className="text-xs text-fg-subtle tabular">{p.qty} un</span>
                                    <span className="w-24 text-right text-sm font-medium text-fg tabular">{formatBRL(p.total)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card padded={false}>
                    <CardHeader title="Últimas vendas" description={`Registros ${periodLabel}`} icon={Receipt} />
                    {stats.recent.length === 0 ? (
                        <EmptyState icon={Receipt} title="Nenhuma venda" description="As vendas registradas aparecem aqui em tempo real." />
                    ) : (
                        <ul className="divide-y divide-line">
                            {stats.recent.map(s => {
                                const d = s.timestamp?.toDate();
                                const its = Array.isArray(s.items) ? s.items : [];
                                const first = its[0]?.name || "Venda";
                                const more = its.length - 1;
                                return (
                                    <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-fg">
                                                {first}{more > 0 && <span className="text-fg-subtle"> +{more}</span>}
                                            </p>
                                            <p className="text-xs text-fg-subtle">{formatDate(d)} · {formatTime(d)}</p>
                                        </div>
                                        <Badge>{s.paymentMethod || "—"}</Badge>
                                        <span className="w-24 text-right text-sm font-medium text-fg tabular">{formatBRL(s.total)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </div>

            {/* Fiados + Reposição */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card padded={false} className="xl:col-span-2 overflow-hidden">
                    <CardHeader
                        title="Contas a receber"
                        description="Vendas no fiado aguardando pagamento"
                        icon={Users}
                        action={stats.pendingFiados.length > 0 && <Badge tone="danger">{formatBRL(stats.pendingTotal)}</Badge>}
                    />
                    {stats.pendingFiados.length === 0 ? (
                        <EmptyState icon={BookOpenText} title="Nenhum fiado em aberto" description="Quando uma venda for registrada no fiado, ela aparece aqui até ser quitada." />
                    ) : (
                        <div className="overflow-x-auto max-h-[360px]">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Data</th>
                                        <th className="!text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.pendingFiados.map(s => {
                                        const name = s.fiado?.nome || s.clientName || "Cliente não informado";
                                        return (
                                            <tr key={s.id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle border border-line text-xs font-semibold text-fg-muted">
                                                            {initials(name)}
                                                        </span>
                                                        <span className="font-medium text-fg">{name}</span>
                                                    </div>
                                                </td>
                                                <td className="tabular">{formatDate(s.timestamp?.toDate())}</td>
                                                <td className="text-right font-medium text-danger tabular">{formatBRL(s.total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                <Card padded={false}>
                    <CardHeader title="Reposição" description="Produtos no estoque mínimo" icon={PackageX} />
                    {stats.lowStock.length === 0 ? (
                        <EmptyState icon={PackageCheck} title="Estoque em dia" description="Nenhum produto abaixo do estoque mínimo." />
                    ) : (
                        <ul className="divide-y divide-line max-h-[360px] overflow-y-auto">
                            {stats.lowStock.slice(0, 12).map(item => {
                                const min = Number(item.minStock) || 5;
                                const stock = Number(item.stock) || 0;
                                return (
                                    <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-fg">{item.name}</p>
                                            <p className="text-xs text-fg-subtle">{item.brand || "Sem marca"} · mínimo {min}</p>
                                        </div>
                                        <Badge tone={stock <= 0 ? "danger" : "warning"}>
                                            {stock <= 0 ? "Esgotado" : `${stock} un`}
                                        </Badge>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </div>
        </Page>
    );
}
