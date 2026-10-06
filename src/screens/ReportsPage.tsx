// src/screens/Reports.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, query, orderBy, where, Timestamp, limit } from "../lib/firestore";
import { db } from "../lib/firebase";
import jsPDF from 'jspdf';
import autoTable from "jspdf-autotable";
import {
    Calendar, DollarSign, ShoppingCart, CreditCard,
    Download, Clock, Search, ArrowUp, ArrowDown
} from "lucide-react";
import { Page, PageHeader, Card, StatCard, Button, Badge, Segmented, SearchInput, EmptyState, LoadingState, ListRow, type Tone } from "../components/ui";
import { formatBRL } from "../lib/format";
import { useStoreData } from "../contexts/StoreDataContext";
import { STORES, STORE_LABEL } from "../lib/stores";
import { Store } from "lucide-react";

interface SaleData {
    id: string;
    items: any[];
    timestamp: any;
    total: number;
    status: string;
    store: string;
    paymentMethod?: string;
    payments?: {
        pix?: number;
        cartao?: number;
        dinheiro?: number;
    };
}

interface FormattedPayment {
    method: string;
    value: number;
}

// Resultados por período guardados por 10 min (o relatório lê muitas vendas de uma vez)
const REPORT_CACHE = new Map<string, { at: number; data: SaleData[] }>();
const REPORT_CACHE_MS = 10 * 60 * 1000;

const EXCLUDED_STORE_EMAIL = "minha-loja@exemplo.com";
const EXCLUDED_STORE_NORMALIZED = EXCLUDED_STORE_EMAIL.toLowerCase().trim();

type StoreView = "atual" | "ambas" | string;

export default function Reports() {
    const { storeEmail } = useStoreData();
    const [storeView, setStoreView] = useState<StoreView>("atual");
    const [sales, setSales] = useState<SaleData[]>([]);
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Estados dos Filtros
    const [period, setPeriod] = useState<
        | "day"
        | "week"
        | "month"
        | "year"
        | "custom_month"
        | "custom_day"
        | "custom"
    >("day");
    const [searchTerm, setSearchTerm] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("all");

    // Estado de Ordenação por Valor
    const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

    // Estados para Filtros Específicos
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedDay, setSelectedDay] = useState("");


    // Calcula o intervalo de datas (start/end) com base no filtro selecionado
    const getDateRange = useCallback(() => {
        const now = new Date();
        let start: Date;
        let end: Date | null = null;

        switch (period) {
            case "day":
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;

            case "week":
                start = new Date();
                start.setDate(now.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                end = new Date();
                break;

            case "month":
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;

            case "year":
                start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;

            case "custom_month":
                start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
                end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
                break;

            case "custom_day":
                if (!selectedDay) {
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                } else {
                    const [y, m, d] = selectedDay.split("-").map(Number);
                    start = new Date(y, m - 1, d, 0, 0, 0);
                    end = new Date(y, m - 1, d, 23, 59, 59);
                }
                break;

            case "custom":
                start = startDate ? new Date(startDate + "T00:00:00") : new Date(0);
                end = endDate ? new Date(endDate + "T23:59:59") : null;
                break;

            default:
                start = new Date(0);
        }

        return { start, end };
    }, [period, selectedMonth, selectedYear, selectedDay, startDate, endDate]);

    // Buscar APENAS as vendas do período no Firebase (Filtragem no Backend)
    useEffect(() => {
        async function fetchSales() {
            setLoading(true);
            try {
                const { start, end } = getDateRange();
                const constraints: any[] = [];

                if (start) {
                    constraints.push(where("timestamp", ">=", Timestamp.fromDate(start)));
                }
                if (end) {
                    constraints.push(where("timestamp", "<=", Timestamp.fromDate(end)));
                }

                constraints.push(orderBy("timestamp", "desc"));
                
                // Trava de segurança para limitar volume
                constraints.push(limit(2000));

                // Cache por período: trocar filtro, loja ou voltar à tela não relê o Firebase
                const key = `${start?.getTime() ?? 0}-${end?.getTime() ?? 0}`;
                const hit = REPORT_CACHE.get(key);
                const ttl = !end || end.getTime() > Date.now() - 86400000 ? 2 * 60 * 1000 : REPORT_CACHE_MS; // período de hoje: cache curto
                if (hit && Date.now() - hit.at < ttl) {
                    setSales(hit.data);
                    return;
                }

                const q = query(collection(db, "sales"), ...constraints);
                const snapshot = await getDocs(q);

                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    total: Number(doc.data().total) || 0,
                    store: String(doc.data().store || "").trim(),
                    items: Array.isArray(doc.data().items) ? doc.data().items.filter(Boolean) : [],
                } as SaleData));

                REPORT_CACHE.set(key, { at: Date.now(), data });
                setSales(data);
            } catch (error) {
                console.error("Erro ao buscar vendas:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchSales();
    }, [getDateRange]);

    const isSaleValid = (sale: SaleData) => {
        const status = sale.status?.toLowerCase();
        const isCompleted = !status || status === "completed" || status === "active" || status === "fiado_quitado";
        const isNotExcluded = sale.store.toLowerCase().trim() !== EXCLUDED_STORE_NORMALIZED;
        return isCompleted && isNotExcluded;
    };

    // Helper para decodificar múltiplos pagamentos
    const getSplitPayments = (sale: SaleData): FormattedPayment[] => {
        const dbPayments = sale.payments || {};
        const splits: FormattedPayment[] = [];

        if (sale.paymentMethod === "Múltiplos" || !sale.paymentMethod) {
            if (Number(dbPayments.pix) > 0) splits.push({ method: "PIX", value: Number(dbPayments.pix) });
            if (Number(dbPayments.cartao) > 0) splits.push({ method: "CARTÃO", value: Number(dbPayments.cartao) });
            if (Number(dbPayments.dinheiro) > 0) splits.push({ method: "DINHEIRO", value: Number(dbPayments.dinheiro) });
        }
        return splits;
    };

    // Filtros adicionais na memória (Apenas texto, método de pagamento e ordenação)
    // Lojas incluídas no relatório
    const viewStores = useMemo(() => {
        if (storeView === "atual") return [storeEmail];
        if (storeView === "ambas") return STORES.map(st => st.email as string);
        return [storeView];
    }, [storeView, storeEmail]);
    const isMulti = viewStores.length > 1;
    const viewLabel = storeView === "ambas" ? "Vila Esportiva + Jardim da Glória" : STORE_LABEL[viewStores[0]] || viewStores[0];

    const processedSales = useMemo(() => {
        const filtered = sales.filter(sale => {
            if (!viewStores.includes(sale.store.toLowerCase())) return false;
            if (!isSaleValid(sale)) return false;

            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                sale.id.toLowerCase().includes(searchLower) ||
                sale.items?.some((item: any) =>
                    item.name?.toLowerCase().includes(searchLower)
                );
            if (!matchesSearch) return false;

            const splits = getSplitPayments(sale);
            if (paymentFilter !== "all") {
                if (sale.paymentMethod?.toUpperCase() === "MÚLTIPLOS" || !sale.paymentMethod) {
                    const hasMethod = splits.some(p => p.method.toUpperCase().includes(paymentFilter.toUpperCase()));
                    if (!hasMethod) return false;
                } else {
                    const matchesPayment = (sale.paymentMethod || "").toUpperCase().includes(paymentFilter.toUpperCase());
                    if (!matchesPayment) return false;
                }
            }

            return true;
        });

        return [...filtered].sort((a, b) => {
            if (sortDirection === "asc") return a.total - b.total;
            return b.total - a.total;
        });
    }, [sales, searchTerm, paymentFilter, sortDirection, viewStores]);

    // Métricas
    const computeMetrics = useCallback((list: SaleData[]) => {
        let totalRevenue = 0;
        let totalPix = 0;
        let totalCartao = 0;
        let totalDinheiro = 0;

        list.forEach(sale => {
            totalRevenue += sale.total;
            const splits = getSplitPayments(sale);

            if (splits.length > 0) {
                splits.forEach(p => {
                    if (p.method.includes("PIX")) totalPix += p.value;
                    if (p.method.includes("CARTÃO")) totalCartao += p.value;
                    if (p.method.includes("DINHEIRO")) totalDinheiro += p.value;
                });
            } else {
                const method = (sale.paymentMethod || "").toUpperCase();
                if (method.includes("PIX")) totalPix += sale.total;
                if (method.includes("CART")) totalCartao += sale.total;
                if (method.includes("DINHEIRO")) totalDinheiro += sale.total;
            }
        });

        const totalSales = list.length;
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        return { totalRevenue, totalPix, totalCartao, totalDinheiro, totalSales, avgTicket };
    }, []);

    const metrics = useMemo(() => computeMetrics(processedSales), [processedSales, computeMetrics]);

    // Comparativo por loja (quando o relatório junta as duas)
    const byStore = useMemo(() => viewStores.map(email => {
        const m = computeMetrics(processedSales.filter(s => s.store.toLowerCase() === email));
        return { email, label: STORE_LABEL[email] || email, ...m, share: metrics.totalRevenue ? m.totalRevenue / metrics.totalRevenue : 0 };
    }), [viewStores, processedSales, computeMetrics, metrics.totalRevenue]);

    const paymentTone = (method?: string): Tone => {
        const m = (method || "").toUpperCase();
        if (m.includes("PIX")) return "success";
        if (m.includes("CARTÃO") || m.includes("CARTAO")) return "info";
        if (m.includes("DINHEIRO")) return "warning";
        if (m.includes("FIADO")) return "danger";
        return "neutral";
    };

    const toggleSort = () => {
        setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    };

    const periodLabel = (() => {
        const { start, end } = getDateRange();
        const f = (d: Date | null) => d ? d.toLocaleDateString("pt-BR") : "";
        if (period === "day") return `Hoje (${f(start)})`;
        if (period === "custom" && !startDate) return end ? `Até ${f(end)}` : "Todo o período";
        return end ? `${f(start)} a ${f(end)}` : `A partir de ${f(start)}`;
    })();

    const describeItems = (sale: SaleData) =>
        sale.items?.map((i: { saleQty?: number; name?: string }) => `${i.saleQty || 1}× ${i.name}`).join(", ") || "Venda direta / serviço";

    // PDF gerado com tabela (texto real, pesquisável) em vez de "print" da tela
    const exportToPDF = () => {
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.setFontSize(16);
        pdf.text("Solucell · Relatório de vendas", 14, 18);
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text(`Loja: ${viewLabel}   ·   Período: ${periodLabel}   ·   Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 25);

        autoTable(pdf, {
            startY: 32,
            head: [["Faturamento", "Vendas", "Ticket médio", "PIX", "Cartão", "Dinheiro"]],
            body: [[
                formatBRL(metrics.totalRevenue), String(metrics.totalSales), formatBRL(metrics.avgTicket),
                formatBRL(metrics.totalPix), formatBRL(metrics.totalCartao), formatBRL(metrics.totalDinheiro),
            ]],
            theme: "grid",
            headStyles: { fillColor: [234, 88, 12] },
            styles: { fontSize: 9 },
        });

        if (isMulti) {
            autoTable(pdf, {
                startY: (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
                head: [["Loja", "Faturamento", "Participação", "Vendas", "Ticket médio", "PIX", "Cartão", "Dinheiro"]],
                body: byStore.map(b => [b.label, formatBRL(b.totalRevenue), `${Math.round(b.share * 100)}%`, String(b.totalSales), formatBRL(b.avgTicket), formatBRL(b.totalPix), formatBRL(b.totalCartao), formatBRL(b.totalDinheiro)]),
                theme: "grid",
                headStyles: { fillColor: [40, 44, 52] },
                styles: { fontSize: 8 },
            });
        }

        autoTable(pdf, {
            startY: (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
            head: [isMulti ? ["Data", "Loja", "Itens", "Pagamento", "Valor"] : ["Data", "Itens", "Pagamento", "Valor"]],
            body: processedSales.map(sale => {
                const d = sale.timestamp?.toDate?.();
                const splits = getSplitPayments(sale);
                return [
                    d ? `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—",
                    ...(isMulti ? [STORE_LABEL[sale.store.toLowerCase()] || sale.store] : []),
                    describeItems(sale),
                    splits.length ? splits.map(p => `${p.method} ${formatBRL(p.value)}`).join(" + ") : (sale.paymentMethod || "—"),
                    formatBRL(sale.total),
                ];
            }),
            theme: "striped",
            headStyles: { fillColor: [40, 44, 52] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: isMulti
                ? { 0: { cellWidth: 26 }, 1: { cellWidth: 26 }, 3: { cellWidth: 34 }, 4: { cellWidth: 22, halign: "right" } }
                : { 0: { cellWidth: 28 }, 2: { cellWidth: 36 }, 3: { cellWidth: 24, halign: "right" } },
        });

        pdf.save(`relatorio_${storeView === "ambas" ? "duas-lojas" : (viewStores[0] || "loja").split("@")[0]}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (loading) return <LoadingState label="Carregando relatório..." />;

    const monthLabel = (i: number) => {
        const l = new Date(2026, i).toLocaleString("pt-BR", { month: "long" });
        return l.charAt(0).toUpperCase() + l.slice(1);
    };

    return (
        <Page>
            <PageHeader
                title="Relatórios"
                description="Analise as vendas por período, forma de pagamento e exporte em PDF."
                meta={<><Badge tone="neutral"><Store size={12} /> {viewLabel}</Badge><Badge tone="neutral"><Calendar size={12} /> {periodLabel}</Badge></>}
                actions={<Button variant="primary" icon={Download} onClick={exportToPDF} disabled={processedSales.length === 0}>Exportar PDF</Button>}
            />

            {/* Loja */}
            <Card padded={false}>
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-fg">Lojas no relatório</p>
                    <Segmented
                        value={storeView === "atual" && STORES.some(st => st.email === storeEmail) ? storeEmail : storeView}
                        onChange={(v) => setStoreView(v === storeEmail ? "atual" : v)}
                        options={[
                            ...(STORES.some(st => st.email === storeEmail) ? [] : [{ value: "atual", label: "Esta conta" }]),
                            ...STORES.map(st => ({ value: st.email as string, label: st.email === storeEmail ? `${st.label} (atual)` : st.label })),
                            { value: "ambas", label: "As duas juntas" },
                        ]}
                    />
                </div>
            </Card>

            {/* Filtros */}
            <Card padded={false}>
                <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-3">
                    <div>
                        <p className="ui-label">Período rápido</p>
                        <Segmented
                            value={["day", "week", "month", "year"].includes(period) ? (period as "day") : ("" as "day")}
                            onChange={(v) => setPeriod(v)}
                            options={[
                                { value: "day", label: "Hoje" },
                                { value: "week", label: "7 dias" },
                                { value: "month", label: "Mês" },
                                { value: "year", label: "Ano" },
                            ]}
                        />
                    </div>
                    <div>
                        <p className="ui-label">Mês específico</p>
                        <div className="flex gap-2">
                            <select
                                value={selectedMonth}
                                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setPeriod("custom_month"); }}
                                className={`ui-input flex-1 ${period === "custom_month" ? "!border-primary" : ""}`}
                            >
                                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{monthLabel(i)}</option>)}
                            </select>
                            <input
                                type="number"
                                value={selectedYear}
                                onChange={(e) => { setSelectedYear(Number(e.target.value)); setPeriod("custom_month"); }}
                                className={`ui-input w-24 text-center tabular ${period === "custom_month" ? "!border-primary" : ""}`}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="ui-label">Intervalo personalizado</p>
                        <div className="flex items-center gap-2">
                            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriod("custom"); }}
                                className={`ui-input ${period === "custom" ? "!border-primary" : ""}`} aria-label="Data inicial" />
                            <span className="text-xs text-fg-subtle">até</span>
                            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriod("custom"); }}
                                className={`ui-input ${period === "custom" ? "!border-primary" : ""}`} aria-label="Data final" />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Faturamento" value={formatBRL(metrics.totalRevenue)} icon={DollarSign} tone="primary"
                    hint={`PIX ${formatBRL(metrics.totalPix)} · Cartão ${formatBRL(metrics.totalCartao)} · Dinheiro ${formatBRL(metrics.totalDinheiro)}`} />
                <StatCard label="Vendas" value={metrics.totalSales} icon={ShoppingCart} tone="info" hint="Vendas concluídas no período" />
                <StatCard label="Ticket médio" value={formatBRL(metrics.avgTicket)} icon={CreditCard} hint="Faturamento ÷ número de vendas" />
            </div>

            {isMulti && (
                <Card padded={false} className="overflow-hidden">
                    <div className="border-b border-line px-5 py-4">
                        <h3 className="text-[15px] font-semibold text-fg">Comparativo entre as lojas</h3>
                        <p className="mt-0.5 text-xs text-fg-subtle">{periodLabel}</p>
                    </div>
                    <div className="grid gap-px bg-line sm:grid-cols-2">
                        {byStore.map(b => (
                            <div key={b.email} className="space-y-3 bg-surface p-5">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-fg">{b.label}</p>
                                    <Badge tone="neutral">{Math.round(b.share * 100)}% do total</Badge>
                                </div>
                                <p className="text-2xl font-semibold tracking-tight text-fg tabular">{formatBRL(b.totalRevenue)}</p>
                                <div className="h-1.5 overflow-hidden rounded-full bg-hover"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(b.share * 100)}%` }} /></div>
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                    <dt className="text-fg-subtle">Vendas</dt><dd className="text-right font-medium text-fg tabular">{b.totalSales}</dd>
                                    <dt className="text-fg-subtle">Ticket médio</dt><dd className="text-right font-medium text-fg tabular">{formatBRL(b.avgTicket)}</dd>
                                    <dt className="text-fg-subtle">PIX</dt><dd className="text-right text-fg-muted tabular">{formatBRL(b.totalPix)}</dd>
                                    <dt className="text-fg-subtle">Cartão</dt><dd className="text-right text-fg-muted tabular">{formatBRL(b.totalCartao)}</dd>
                                    <dt className="text-fg-subtle">Dinheiro</dt><dd className="text-right text-fg-muted tabular">{formatBRL(b.totalDinheiro)}</dd>
                                </dl>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card padded={false} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
                    <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por item ou código da venda..." className="w-full md:w-80" />
                    <div className="flex items-center gap-2">
                        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="ui-input w-auto">
                            <option value="all">Todas as formas</option>
                            <option value="pix">PIX</option>
                            <option value="cartão">Cartão</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="fiado">Fiado</option>
                        </select>
                        <Button icon={sortDirection === "desc" ? ArrowDown : ArrowUp} onClick={toggleSort}>
                            {sortDirection === "desc" ? "Maior valor" : "Menor valor"}
                        </Button>
                    </div>
                </div>

                {processedSales.length === 0 ? (
                    <EmptyState icon={ShoppingCart} title="Nenhuma venda no período" description="Escolha outro período ou ajuste os filtros." />
                ) : (
                    <>
                    <ul className="md:hidden divide-y divide-line">
                        {processedSales.map(sale => {
                            const splits = getSplitPayments(sale);
                            const d = sale.timestamp?.toDate?.();
                            return (
                                <ListRow
                                    key={sale.id}
                                    title={<span className="line-clamp-2">{describeItems(sale)}</span>}
                                    value={formatBRL(sale.total)}
                                    subtitle={`${isMulti ? `${STORE_LABEL[sale.store.toLowerCase()] || sale.store} · ` : ""}${d ? `${d.toLocaleDateString("pt-BR")} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—"}`}
                                    meta={splits.length > 0
                                        ? splits.map((p, idx) => <Badge key={idx} tone={paymentTone(p.method)}>{p.method.charAt(0) + p.method.slice(1).toLowerCase()} {formatBRL(p.value)}</Badge>)
                                        : <Badge tone={paymentTone(sale.paymentMethod)}>{sale.paymentMethod || "Não informado"}</Badge>}
                                />
                            );
                        })}
                        <li className="flex items-center justify-between bg-subtle px-4 py-3 text-sm">
                            <span className="font-medium text-fg">Total ({metrics.totalSales})</span>
                            <span className="font-bold text-fg tabular">{formatBRL(metrics.totalRevenue)}</span>
                        </li>
                    </ul>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="ui-table min-w-[720px]">
                            <thead>
                                <tr>
                                    {isMulti && <th>Loja</th>}
                                    <th>Itens</th>
                                    <th>Pagamento</th>
                                    <th>Data</th>
                                    <th className="!text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedSales.map(sale => {
                                    const splits = getSplitPayments(sale);
                                    const d = sale.timestamp?.toDate?.();
                                    return (
                                        <tr key={sale.id}>
                                            {isMulti && <td><Badge>{STORE_LABEL[sale.store.toLowerCase()] || sale.store}</Badge></td>}
                                            <td className="max-w-[460px]">
                                                <p className="truncate text-fg">{describeItems(sale)}</p>
                                                <p className="mt-0.5 font-mono text-[11px] text-fg-faint select-all">{sale.id}</p>
                                            </td>
                                            <td>
                                                {splits.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {splits.map((p, idx) => <Badge key={idx} tone={paymentTone(p.method)}>{p.method.charAt(0) + p.method.slice(1).toLowerCase()} {formatBRL(p.value)}</Badge>)}
                                                    </div>
                                                ) : (
                                                    <Badge tone={paymentTone(sale.paymentMethod)}>{sale.paymentMethod || "Não informado"}</Badge>
                                                )}
                                            </td>
                                            <td className="tabular whitespace-nowrap">
                                                <span className="text-fg">{d?.toLocaleDateString("pt-BR")}</span>
                                                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-fg-subtle"><Clock size={11} />{d?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </td>
                                            <td className="text-right font-semibold text-fg tabular">{formatBRL(sale.total)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={isMulti ? 4 : 3} className="border-t border-line bg-subtle px-4 py-3 text-sm font-medium text-fg">Total ({metrics.totalSales} vendas)</td>
                                    <td className="border-t border-line bg-subtle px-4 py-3 text-right text-sm font-semibold text-fg tabular">{formatBRL(metrics.totalRevenue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    </>
                )}
            </Card>
        </Page>
    );
}
