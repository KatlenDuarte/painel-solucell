// src/screens/SalesFuncionarioPage.tsx
import { useState, useMemo } from "react";
import {
    Plus,
    Search,
    CreditCard,
    Smartphone,
    DollarSign,
    Eye,
    EyeOff,
    User,
    TrendingUp,
    Receipt
} from "lucide-react";
import { Page, PageHeader, Card, StatCard, Button, Badge, Segmented, SearchInput, EmptyState, LoadingState, ListRow } from "../components/ui";
import { formatBRL } from "../lib/format";

import { useStoreData } from "../contexts/StoreDataContext";

import NewSaleModal from "../components/NewSaleModal";

interface SaleItem {
    name: string;
    saleQty: number;
    price: number;
}

interface FormattedPayment {
    method: string;
    value: number;
}

interface SaleWithClient {
    id: string;
    date: string;
    time: string;
    items: SaleItem[];
    total: number;
    payment: string;
    status: string;
    dateObject?: Date;
    clientName?: string;
    splitPayments?: FormattedPayment[];
}

interface Props {
    storeEmail: string;
}

export default function SalesFuncionarioPage({ storeEmail }: Props) {
    const [filter, setFilter] = useState<"today" | "week" | "month">("today");
    const [searchTerm, setSearchTerm] = useState("");
    const [hideValues, setHideValues] = useState(false);

    const { sales: salesDocs, salesLoading: isLoading } = useStoreData();
    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // ================= FETCH =================
    // Vendas em tempo real pelo listener compartilhado (StoreDataContext).
    const sales = useMemo<SaleWithClient[]>(() => {
        const list: SaleWithClient[] = salesDocs.map((doc) => {
                const data = doc.data();
                const isFiadoQuitado =
                    data.paidAt &&
                    (
                        data.paymentMethod === "Fiado (Quitado)" ||
                        data.originalPaymentMethod === "Fiado"
                    );

                const ts = isFiadoQuitado
                    ? data.paidAt.toDate()
                    : data.timestamp?.toDate();

                const dbPayments = data.payments || {};
                const splitPayments: FormattedPayment[] = [];

                if (data.paymentMethod === "Múltiplos" || !data.paymentMethod) {
                    if (Number(dbPayments.pix) > 0) {
                        splitPayments.push({
                            method: "PIX",
                            value: Number(dbPayments.pix)
                        });
                    }

                    if (Number(dbPayments.cartao) > 0) {
                        splitPayments.push({
                            method: "CARTÃO",
                            value: Number(dbPayments.cartao)
                        });
                    }

                    if (Number(dbPayments.dinheiro) > 0) {
                        splitPayments.push({
                            method: "DINHEIRO",
                            value: Number(dbPayments.dinheiro)
                        });
                    }
                }

                return {
                    id: doc.id,
                    dateObject: ts,
                    date: ts
                        ? ts.toLocaleDateString("pt-BR")
                        : "--/--/----",
                    time: ts
                        ? ts.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit"
                        })
                        : "--:--",
                    items: Array.isArray(data.items)
                        ? data.items.filter(Boolean).map((i: { name?: string; saleQty?: number; quantity?: number; price?: number }) => ({
                            name: String(i.name ?? "Item"),
                            saleQty: Number(i.saleQty ?? i.quantity ?? 1) || 1,
                            price: Number(i.price) || 0,
                        }))
                        : [],
                    total: Number(data.total) || 0,
                    payment: String(data.paymentMethod || "Não informado"),
                    status: data.status || "completed",
                    clientName:
                        data.clientName ||
                        data.fiado?.nome ||
                        data.payments?.fiado?.nome ||
                        null,
                    splitPayments:
                        splitPayments.length > 0
                            ? splitPayments
                            : undefined
                };
            });
        return list.sort(
            (a, b) =>
                (b.dateObject?.getTime() || 0) -
                (a.dateObject?.getTime() || 0)
        );
    }, [salesDocs]);


    // ================= FILTROS =================
    const filteredByPeriod = sales.filter((sale) => {
        if (!sale.dateObject) return false;

        const now = new Date();
        const saleDate = sale.dateObject;

        if (filter === "today") {
            return saleDate.toDateString() === now.toDateString();
        }

        if (filter === "week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            return saleDate >= oneWeekAgo;
        }

        if (filter === "month") {
            return (
                saleDate.getMonth() === now.getMonth() &&
                saleDate.getFullYear() === now.getFullYear()
            );
        }

        return true;
    });

    const normalize = (text: string) =>
        text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();

    // ================= STATS =================
    const stats = filteredByPeriod.reduce(
        (acc, sale) => {
            if (
                sale.status === "refunded" ||
                sale.status === "cancelled"
            ) {
                return acc;
            }

            if (sale.splitPayments && sale.splitPayments.length > 0) {
                sale.splitPayments.forEach((p) => {
                    const method = normalize(p.method);

                    if (method.includes("PIX")) {
                        acc.pix += p.value;
                    }

                    if (method.includes("CARTAO")) {
                        acc.cartao += p.value;
                    }

                    if (method.includes("DINHEIRO")) {
                        acc.dinheiro += p.value;
                    }
                });
            } else {
                const method = normalize(sale.payment);

                if (method.includes("PIX")) {
                    acc.pix += sale.total;
                }

                if (method.includes("CARTAO")) {
                    acc.cartao += sale.total;
                }

                if (method.includes("DINHEIRO")) {
                    acc.dinheiro += sale.total;
                }
            }

            acc.total += sale.total;

            return acc;
        },
        {
            pix: 0,
            cartao: 0,
            dinheiro: 0,
            total: 0
        }
    );

    const finalFilteredSales = filteredByPeriod.filter((sale) => {
        const search = searchTerm.toLowerCase();

        return (
            search === "" ||
            sale.items.some((i) =>
                i.name.toLowerCase().includes(search)
            ) ||
            sale.clientName?.toLowerCase().includes(search)
        );
    });

    const money = (v: number) => (hideValues ? "R$ ••••" : formatBRL(v));
    const periodLabel = filter === "today" ? "hoje" : filter === "week" ? "nos últimos 7 dias" : "neste mês";
    const pct = (v: number) => (stats.total ? `${Math.round((v / stats.total) * 100)}% do total` : "—");

    return (
        <Page>
            {isNewSaleModalOpen && (
                <NewSaleModal
                    storeEmail={storeEmail}
                    onClose={() => setIsNewSaleModalOpen(false)}
                    onSaleComplete={() => {}}
                />
            )}

            <PageHeader
                title="Vendas"
                description="Registre operações e acompanhe o movimento do caixa."
                actions={
                    <>
                        <Button icon={hideValues ? EyeOff : Eye} onClick={() => setHideValues(!hideValues)}>
                            {hideValues ? "Mostrar valores" : "Ocultar valores"}
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={() => setIsNewSaleModalOpen(true)}>
                            Nova venda
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total" value={money(stats.total)} icon={TrendingUp} tone="primary" hint={`${filteredByPeriod.length} operações ${periodLabel}`} />
                <StatCard label="PIX" value={money(stats.pix)} icon={Smartphone} tone="success" hint={pct(stats.pix)} />
                <StatCard label="Cartão" value={money(stats.cartao)} icon={CreditCard} tone="info" hint={pct(stats.cartao)} />
                <StatCard label="Dinheiro" value={money(stats.dinheiro)} icon={DollarSign} tone="warning" hint={pct(stats.dinheiro)} />
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
                    <Segmented
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: "today", label: "Hoje" },
                            { value: "week", label: "7 dias" },
                            { value: "month", label: "Mês" },
                        ]}
                    />
                    <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Buscar item ou cliente..." className="w-full md:w-72" />
                </div>

                {isLoading ? (
                    <LoadingState label="Carregando vendas..." />
                ) : finalFilteredSales.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Nenhuma venda encontrada"
                        description={searchTerm ? "Ajuste a busca para ver mais resultados." : `Não há operações registradas ${periodLabel}.`}
                        action={<Button variant="primary" icon={Plus} onClick={() => setIsNewSaleModalOpen(true)}>Registrar venda</Button>}
                    />
                ) : (
                    <>
                    <ul className="md:hidden divide-y divide-line">
                        {finalFilteredSales.map((sale) => {
                            const inactive = sale.status === "refunded" || sale.status === "cancelled";
                            return (
                                <ListRow
                                    key={sale.id}
                                    className={inactive ? "opacity-60" : ""}
                                    leading={<span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text"><Receipt size={18} /></span>}
                                    title={<span className={`line-clamp-2 ${inactive ? "line-through" : ""}`}>{sale.items.map(i => `${i.saleQty}× ${i.name}`).join(", ") || "Venda"}</span>}
                                    value={money(sale.total)}
                                    subtitle={<>{sale.date} · {sale.time}{sale.clientName ? ` · ${sale.clientName}` : ""}</>}
                                    meta={<>
                                        {sale.status === "pending" ? <Badge tone="warning" dot>Fiado pendente</Badge>
                                            : sale.status === "refunded" ? <Badge tone="danger" dot>Estornada</Badge>
                                                : sale.status === "cancelled" ? <Badge dot>Cancelada</Badge>
                                                    : <Badge tone="success" dot>Concluída</Badge>}
                                        <Badge>{sale.splitPayments && sale.splitPayments.length > 1 ? "Múltiplos" : sale.payment}</Badge>
                                    </>}
                                />
                            );
                        })}
                    </ul>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="ui-table min-w-[720px]">
                            <thead>
                                <tr>
                                    <th className="w-36">Data</th>
                                    <th>Itens</th>
                                    <th>Pagamento</th>
                                    <th>Status</th>
                                    <th className="!text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalFilteredSales.map((sale) => {
                                    const inactive = sale.status === "refunded" || sale.status === "cancelled";
                                    return (
                                        <tr key={sale.id} className={inactive ? "opacity-60" : ""}>
                                            <td className="tabular whitespace-nowrap">
                                                <span className="text-fg">{sale.time}</span>
                                                <span className="ml-2 text-xs text-fg-subtle">{sale.date}</span>
                                            </td>
                                            <td className="max-w-[420px]">
                                                <p className={`truncate ${inactive ? "line-through" : "text-fg"}`}>
                                                    {sale.items.map((item, idx) => (
                                                        <span key={idx}>
                                                            <span className="text-fg-subtle">{item.saleQty}×</span> {item.name}
                                                            {idx < sale.items.length - 1 ? ", " : ""}
                                                        </span>
                                                    ))}
                                                </p>
                                                {sale.clientName && (
                                                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-subtle">
                                                        <User size={11} /> {sale.clientName}
                                                    </p>
                                                )}
                                            </td>
                                            <td>
                                                {sale.splitPayments && sale.splitPayments.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {sale.splitPayments.map((p, i) => (
                                                            <Badge key={i}>{p.method.charAt(0) + p.method.slice(1).toLowerCase()} {hideValues ? "" : formatBRL(p.value)}</Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <Badge>{sale.payment}</Badge>
                                                )}
                                            </td>
                                            <td>
                                                {sale.status === "pending" ? <Badge tone="warning" dot>Fiado pendente</Badge>
                                                    : sale.status === "refunded" ? <Badge tone="danger" dot>Estornada</Badge>
                                                        : sale.status === "cancelled" ? <Badge dot>Cancelada</Badge>
                                                            : <Badge tone="success" dot>Concluída</Badge>}
                                            </td>
                                            <td className={`text-right font-semibold tabular whitespace-nowrap ${inactive ? "line-through" : "text-fg"}`}>
                                                {money(sale.total)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </Card>
        </Page>
    );
}
