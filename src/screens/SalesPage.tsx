// src/screens/Sales.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Plus, Search, CreditCard, Smartphone,
    DollarSign, Undo2, TrendingUp, Eye, EyeOff,
    Pencil, User, Wrench, Printer, Receipt, X, ShoppingBag
} from "lucide-react";
import { Page, PageHeader, Card, StatCard, Button, IconButton, Badge, Segmented, SearchInput, EmptyState, LoadingState, ListRow } from "../components/ui";
import { formatBRL } from "../lib/format";
import DateRangeFilter from "../components/DateRangeFilter";
import { inDateRange, describeRange, toInputDate, type DateRange } from "../lib/dateRange";

import { useStoreData } from "../contexts/StoreDataContext";

import RefundConfirmationModal from "../components/RefundConfirmationModal";
import NewSaleModal from "../components/NewSaleModal";
import EditSaleModal from "../components/EditSaleModal";

interface SaleItem {
    id: string;
    name: string;
    saleQty: number;
    price: number;
}


// Interface para suportar múltiplos pagamentos na mesma venda
interface MultiplePayment {
    method: "PIX" | "CARTÃO" | "DINHEIRO" | string;
    value: number;
}

interface SaleWithClient {
    id: string;
    date: string;
    time: string;
    items: SaleItem[];
    total: number;
    payment: string; // Mantido para compatibilidade anterior
    status: "completed" | "pending" | "refunded" | "cancelled" | "loss";
    dateObject?: Date;
    clientName?: string;

    // NOVOS CAMPOS ADICIONADOS:
    type: "venda" | "manutencao";
    partCost?: number;          // Custo da peça se for manutenção
    multiplePayments?: MultiplePayment[]; // Array se houver mais de uma forma de pagamento
}

// Garante formato consistente dos itens (registros antigos podem não ter nome/quantidade)
const normalizeItems = (items: unknown): SaleItem[] =>
    Array.isArray(items)
        ? items.filter(Boolean).map((i: Partial<SaleItem> & { quantity?: number }) => ({
            id: String(i.id ?? ""),
            name: String(i.name ?? "Item"),
            saleQty: Number(i.saleQty ?? i.quantity ?? 1) || 1,
            price: Number(i.price) || 0,
        }))
        : [];

interface SalesProps {
    storeEmail: string;
}

export default function Sales({ storeEmail }: SalesProps) {
    const [filter, setFilter] = useState<"today" | "week" | "month" | "custom">("today");
    const [range, setRange] = useState<DateRange>(() => {
        const now = new Date();
        return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) };
    });

    const [selectedMethodCard, setSelectedMethodCard] = useState<"PIX" | "CARTAO" | "DINHEIRO" | "TOTAL" | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
    const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<SaleWithClient | null>(null);
    const [barcodeInput, setBarcodeInput] = useState("");
    const barcodeRef = useRef<HTMLInputElement>(null);
    const { sales: salesDocs, salesLoading: isLoading, products: productDocs } = useStoreData();

    useEffect(() => {
        const handleKeyPress = async (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;

            const code = barcodeInput.trim();

            if (!code) return;

            try {
                // Busca no estoque já carregado em memória (sem leitura extra no Firestore)
                const found = productDocs.find(d => String(d.data().barcode ?? "").trim() === code);

                if (!found) {
                    alert("Produto não encontrado.");
                    setBarcodeInput("");
                    return;
                }

                const product = { id: found.id, ...found.data() };

                setIsNewSaleModal(true);

                setTimeout(() => {
                    window.dispatchEvent(
                        new CustomEvent("scanner-product", {
                            detail: product
                        })
                    );
                }, 300);

                setBarcodeInput("");
            } catch (err) {
                console.error(err);
            }
        };

        window.addEventListener("keydown", handleKeyPress);

        return () =>
            window.removeEventListener("keydown", handleKeyPress);
    }, [barcodeInput, productDocs]);

    const [hideValues, setHideValues] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Vendas em tempo real pelo listener compartilhado (StoreDataContext).
    const sales = useMemo<SaleWithClient[]>(() => salesDocs.map((doc) => {
                const data = doc.data() as any;
                const ts = data.timestamp?.toDate();

                return {
                    id: doc.id,
                    dateObject: ts,
                    date: ts ? ts.toLocaleDateString("pt-BR") : "--/--/----",
                    time: ts ? ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
                    items: normalizeItems(data.items),
                    total: Number(data.total) || 0,
                    payment: String(data.paymentMethod || "PIX"),
                    status: data.status || (data.paymentMethod === "Fiado" ? "pending" : "completed"),
                    clientName: data.clientName || data.fiado?.nome || data.payments?.fiado?.nome,

                    // Tratamento dos novos campos vindo do Firebase
                    type: data.type || "venda",
                    partCost: Number(data.partCost) || 0,
                    multiplePayments:
                        (Array.isArray(data.multiplePayments) ? data.multiplePayments.filter((p: { method?: string }) => p && p.method) : null) ||
                        (data.payments
                            ? [
                                ...(data.payments.pix > 0
                                    ? [{ method: "PIX", value: data.payments.pix }]
                                    : []),

                                ...(data.payments.cartao > 0
                                    ? [{ method: "CARTÃO", value: data.payments.cartao }]
                                    : []),

                                ...(data.payments.dinheiro > 0
                                    ? [{ method: "DINHEIRO", value: data.payments.dinheiro }]
                                    : [])
                            ]
                            : null)
                };
            })
                .sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0)), [salesDocs]);

    // Mantido para os callbacks dos modais: o listener já reflete as alterações.
    const fetchSalesFromFirestore = useCallback(() => {}, []);


    const handlePrintSale = async (sale: SaleWithClient) => {
        try {
            const response = await fetch("http://localhost:3333/print", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    customer: sale.clientName || "",
                    paymentMethod: sale.payment,
                    total: sale.total,
                    items: sale.items,
                    isOS: sale.type === "manutencao"
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro ao imprimir");
            }

            alert("Cupom enviado para impressão!");
        } catch (err) {
            console.error(err);
            alert("Erro ao imprimir.");
        }
    };

    // 1. Filtragem estrita por período/data
    const filteredByPeriod = sales.filter(sale => {
        if (!sale.dateObject) return false;
        const now = new Date();
        const saleDate = sale.dateObject;

        if (filter === "today") return saleDate.toDateString() === now.toDateString();
        if (filter === "week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return saleDate >= oneWeekAgo;
        }
        if (filter === "month") {
            return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        }
        if (filter === "custom") return inDateRange(saleDate, range);
        return true;
    });

    const isLoss = (sale: SaleWithClient) =>
        sale.status === "loss" || sale.type === "perda";

    const getSumByMethod = (salesList: SaleWithClient[], method: string) => {
        return salesList
            .filter(s =>
                s.status !== "refunded" &&
                s.status !== "cancelled" &&
                !isLoss(s)
            )
            .reduce((acc, sale) => {
                if (sale.multiplePayments?.length) {
                    const totalMetodo = sale.multiplePayments
                        .filter(p => p.method.toUpperCase().includes(method))
                        .reduce((t, p) => t + p.value, 0);

                    return acc + totalMetodo;
                }

                return acc +
                    (sale.payment.toUpperCase().includes(method)
                        ? sale.total
                        : 0);
            }, 0);
    };

    // Cômputo dos cards atualizado para verificar se há pagamentos múltiplos splitados
    const losses = filteredByPeriod
        .filter(isLoss)
        .reduce((acc, sale) => acc + sale.total, 0);

    const stats = {
        pix: getSumByMethod(filteredByPeriod, "PIX"),

        cartao:
            getSumByMethod(filteredByPeriod, "CARTÃO") +
            getSumByMethod(filteredByPeriod, "CARTAO"),

        dinheiro: getSumByMethod(filteredByPeriod, "DINHEIRO"),

        total: filteredByPeriod
            .filter(s =>
                s.status !== "refunded" &&
                s.status !== "cancelled" &&
                !isLoss(s)
            )
            .reduce((acc, curr) => acc + curr.total, 0),

        perdas: losses
    };

    // 2. Aplica filtro do Card Selecionado + Busca por Texto
    const normalize = (text: string) =>
        text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();

    const finalFilteredSales = filteredByPeriod.filter((sale) => {
        // Filtro do Card Clicado (Verifica tanto o payment fixo quanto a lista de múltiplos pagamentos)
        if (selectedMethodCard) {
            const searchMap: Record<string, string> = { PIX: "PIX", CARTAO: "CARTAO", DINHEIRO: "DINHEIRO" };
            const target = searchMap[selectedMethodCard];

            if (target) {
                const hasInMultiple = sale.multiplePayments?.some(
                    p => normalize(p.method).includes(target)
                );

                const hasInSingle = normalize(sale.payment).includes(target);

                if (!hasInMultiple && !hasInSingle) return false;
            }
        }

        // Filtro de Busca por Input
        const search = searchTerm.toLowerCase();
        return search === "" ||
            sale.items.some(i => i.name.toLowerCase().includes(search)) ||
            sale.clientName?.toLowerCase().includes(search);
    });

    const handleCardClick = (cardType: "PIX" | "CARTAO" | "DINHEIRO" | "TOTAL") => {
        if (selectedMethodCard === cardType) {
            setSelectedMethodCard(null);
        } else {
            setSelectedMethodCard(cardType);
        }
    };

    // 3. Agrupamento por data para a linha do tempo (extrato)
    const groupedSales = finalFilteredSales.reduce<Record<string, SaleWithClient[]>>((acc, sale) => {
        if (!acc[sale.date]) acc[sale.date] = [];
        acc[sale.date].push(sale);
        return acc;
    }, {});

    const todayLabel = new Date().toLocaleDateString("pt-BR");

    const money = (v: number) => (hideValues ? "R$ ••••" : formatBRL(v));

    const periodLabel = filter === "today" ? "hoje" : filter === "week" ? "nos últimos 7 dias" : filter === "month" ? "neste mês" : describeRange(range);

    const statusBadge = (sale: SaleWithClient) => {
        if (isLoss(sale)) return <Badge tone="danger" dot>Perda</Badge>;
        if (sale.status === "refunded") return <Badge tone="danger" dot>Estornada</Badge>;
        if (sale.status === "cancelled") return <Badge dot>Cancelada</Badge>;
        if (sale.status === "pending") return <Badge tone="warning" dot>Fiado pendente</Badge>;
        return <Badge tone="success" dot>Concluída</Badge>;
    };

    return (
        <Page>
            <RefundConfirmationModal
                saleId={refundSaleId}
                items={sales.find(s => s.id === refundSaleId)?.items}
                onClose={() => {
                    setIsModalOpen(false);
                    setRefundSaleId(null);
                }}
                onRefundSuccess={fetchSalesFromFirestore}
            />

            {isNewSaleModalOpen && (
                <NewSaleModal
                    onClose={() => {
                        setIsNewSaleModal(false);
                    }}
                    storeEmail={storeEmail}
                    onSaleComplete={fetchSalesFromFirestore}
                />
            )}

            <EditSaleModal
                sale={saleToEdit}
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSaleToEdit(null);
                }}
                onSave={fetchSalesFromFirestore}
            />

            <input
                ref={barcodeRef}
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
                type="text"
            />

            <PageHeader
                title="Vendas"
                description="Acompanhe o caixa, filtre por forma de pagamento e gerencie cada operação."
                actions={
                    <>
                        <Button icon={hideValues ? EyeOff : Eye} onClick={() => setHideValues(!hideValues)}>
                            {hideValues ? "Mostrar valores" : "Ocultar valores"}
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={() => setIsNewSaleModal(true)}>
                            Nova venda
                        </Button>
                    </>
                }
            />

            {/* Resumo por forma de pagamento (clique para filtrar) */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    label="Faturamento"
                    value={money(stats.total)}
                    icon={TrendingUp}
                    tone="primary"
                    active={selectedMethodCard === null}
                    onClick={() => setSelectedMethodCard(null)}
                    hint={losses > 0 ? `${money(losses)} em perdas ${periodLabel}` : `${filteredByPeriod.length} operações ${periodLabel}`}
                />
                <StatCard label="PIX" value={money(stats.pix)} icon={Smartphone} tone="success"
                    active={selectedMethodCard === "PIX"} onClick={() => handleCardClick("PIX")}
                    hint={stats.total ? `${Math.round((stats.pix / stats.total) * 100)}% do total` : "—"} />
                <StatCard label="Cartão" value={money(stats.cartao)} icon={CreditCard} tone="info"
                    active={selectedMethodCard === "CARTAO"} onClick={() => handleCardClick("CARTAO")}
                    hint={stats.total ? `${Math.round((stats.cartao / stats.total) * 100)}% do total` : "—"} />
                <StatCard label="Dinheiro" value={money(stats.dinheiro)} icon={DollarSign} tone="warning"
                    active={selectedMethodCard === "DINHEIRO"} onClick={() => handleCardClick("DINHEIRO")}
                    hint={stats.total ? `${Math.round((stats.dinheiro / stats.total) * 100)}% do total` : "—"} />
            </div>

            <Card padded={false} className="overflow-hidden">
                {/* Barra de filtros */}
                <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                            value={filter}
                            onChange={(f) => { setFilter(f); setSelectedMethodCard(null); }}
                            options={[
                                { value: "today", label: "Hoje" },
                                { value: "week", label: "7 dias" },
                                { value: "month", label: "Mês" },
                                { value: "custom", label: "Período" },
                            ]}
                        />
                        {filter === "custom" && (
                            <div className="basis-full pt-1">
                                <DateRangeFilter value={range} onChange={(r) => { setRange(r); setSelectedMethodCard(null); }} />
                            </div>
                        )}
                        {selectedMethodCard && (
                            <Badge tone="primary">
                                Filtro: {selectedMethodCard === "CARTAO" ? "Cartão" : selectedMethodCard === "DINHEIRO" ? "Dinheiro" : "PIX"}
                                <button onClick={() => setSelectedMethodCard(null)} className="ml-1 hover:opacity-70" aria-label="Limpar filtro">
                                    <X size={12} />
                                </button>
                            </Badge>
                        )}
                    </div>
                    <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Buscar item ou cliente..." className="w-full lg:w-72" />
                </div>

                {isLoading ? (
                    <LoadingState label="Carregando vendas..." />
                ) : finalFilteredSales.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="Nenhuma venda encontrada"
                        description={searchTerm || selectedMethodCard ? "Ajuste a busca ou os filtros para ver mais resultados." : `Não há operações registradas ${periodLabel}.`}
                        action={<Button variant="primary" icon={Plus} onClick={() => setIsNewSaleModal(true)}>Registrar venda</Button>}
                    />
                ) : (
                    <>
                    {/* Celular: lista em cartões */}
                    <div className="md:hidden">
                        {Object.entries(groupedSales).map(([dateKey, salesForDate]) => (
                            <section key={dateKey}>
                                <div className="sticky top-14 z-10 flex items-center justify-between bg-subtle/95 backdrop-blur px-4 py-2 text-xs border-y border-line">
                                    <span className="font-semibold text-fg">{dateKey === todayLabel ? "Hoje" : dateKey}</span>
                                    <span className="text-fg-subtle">{salesForDate.length} {salesForDate.length === 1 ? "operação" : "operações"}</span>
                                </div>
                                <ul className="divide-y divide-line">
                                    {salesForDate.map((sale) => {
                                        const inactive = sale.status === "refunded" || sale.status === "cancelled";
                                        const isLossSale = isLoss(sale);
                                        return (
                                            <ListRow
                                                key={sale.id}
                                                className={inactive ? "opacity-60" : ""}
                                                leading={
                                                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sale.type === "manutencao" ? "bg-info-soft text-info" : isLossSale ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-text"}`}>
                                                        {sale.type === "manutencao" ? <Wrench size={18} /> : <ShoppingBag size={18} />}
                                                    </span>
                                                }
                                                title={<span className={`line-clamp-2 ${inactive ? "line-through" : ""}`}>{sale.items.map(i => `${i.saleQty}× ${i.name}`).join(", ") || "Venda"}</span>}
                                                value={<span className={isLossSale ? "text-danger" : inactive ? "line-through" : ""}>{isLossSale ? "− " : ""}{money(sale.total)}</span>}
                                                subtitle={<>{sale.time}{sale.clientName ? ` · ${sale.clientName}` : ""}</>}
                                                meta={<>{statusBadge(sale)}<Badge>{sale.multiplePayments && sale.multiplePayments.length > 1 ? "Múltiplos" : sale.payment}</Badge></>}
                                                actions={!inactive && (
                                                    <>
                                                        <IconButton icon={Printer} label="Imprimir cupom" onClick={() => handlePrintSale(sale)} />
                                                        <IconButton icon={Pencil} label="Editar" onClick={() => { setSaleToEdit(sale); setIsEditModalOpen(true); }} />
                                                        <IconButton icon={Undo2} label="Estornar" tone="danger" onClick={() => { setRefundSaleId(sale.id); setIsModalOpen(true); }} />
                                                    </>
                                                )}
                                            />
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                    </div>

                    {/* Desktop: tabela */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="ui-table min-w-[820px]">
                            <thead>
                                <tr>
                                    <th className="w-20">Hora</th>
                                    <th>Itens</th>
                                    <th>Pagamento</th>
                                    <th>Status</th>
                                    <th className="!text-right">Valor</th>
                                    <th className="w-28 !text-right">Ações</th>
                                </tr>
                            </thead>
                            {Object.entries(groupedSales).map(([dateKey, salesForDate]) => {
                                const dayTotal = salesForDate
                                    .filter(s => s.status !== "refunded" && s.status !== "cancelled" && !isLoss(s))
                                    .reduce((acc, s) => acc + s.total, 0);
                                return (
                                    <tbody key={dateKey}>
                                        <tr>
                                            <td colSpan={6} className="!py-2 bg-subtle">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-fg">{dateKey === todayLabel ? `Hoje · ${dateKey}` : dateKey}</span>
                                                    <span className="text-fg-subtle">
                                                        {salesForDate.length} {salesForDate.length === 1 ? "operação" : "operações"} · <span className="font-medium text-fg tabular">{money(dayTotal)}</span>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {salesForDate.map((sale) => {
                                            const isRefunded = sale.status === "refunded";
                                            const isCancelled = sale.status === "cancelled";
                                            const isLossSale = isLoss(sale);
                                            const inactive = isRefunded || isCancelled;
                                            const partCost = sale.partCost || 0;
                                            const profit = sale.total - partCost;

                                            return (
                                                <tr key={sale.id} className={inactive ? "opacity-60" : ""}>
                                                    <td className="tabular text-fg-subtle">{sale.time}</td>
                                                    <td className="max-w-[420px]">
                                                        <div className="flex items-center gap-2">
                                                            {sale.type === "manutencao" && (
                                                                <span title="Manutenção" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                                                                    <Wrench size={12} />
                                                                </span>
                                                            )}
                                                            <p className={`truncate ${inactive ? "line-through" : "text-fg"}`}>
                                                                {sale.items.map((item, idx) => (
                                                                    <span key={idx}>
                                                                        <span className="text-fg-subtle">{item.saleQty}×</span> {item.name}
                                                                        {idx < sale.items.length - 1 ? ", " : ""}
                                                                    </span>
                                                                ))}
                                                            </p>
                                                        </div>
                                                        {(sale.clientName || (sale.type === "manutencao" && !inactive && !isLossSale)) && (
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-subtle">
                                                                {sale.clientName && <span className="inline-flex items-center gap-1"><User size={11} /> {sale.clientName}</span>}
                                                                {sale.type === "manutencao" && !inactive && !isLossSale && (
                                                                    <span>Peça {money(partCost)} · <span className="text-success">lucro {money(profit)}</span></span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {sale.multiplePayments && sale.multiplePayments.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {sale.multiplePayments.map((p, pIdx) => (
                                                                    <Badge key={pIdx}>{p.method.charAt(0) + p.method.slice(1).toLowerCase()} {hideValues ? "" : formatBRL(p.value)}</Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <Badge>{sale.payment}</Badge>
                                                        )}
                                                    </td>
                                                    <td>{statusBadge(sale)}</td>
                                                    <td className={`text-right font-semibold tabular whitespace-nowrap ${isLossSale ? "text-danger" : inactive ? "line-through" : "text-fg"}`}>
                                                        {isLossSale ? "− " : ""}{money(sale.total)}
                                                    </td>
                                                    <td>
                                                        {!inactive && (
                                                            <div className="flex items-center justify-end gap-0.5">
                                                                <IconButton icon={Printer} label="Imprimir cupom" tone="primary" onClick={() => handlePrintSale(sale)} />
                                                                <IconButton icon={Pencil} label="Editar" onClick={() => { setSaleToEdit(sale); setIsEditModalOpen(true); }} />
                                                                <IconButton icon={Undo2} label="Estornar" tone="danger" onClick={() => { setRefundSaleId(sale.id); setIsModalOpen(true); }} />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                    </>
                )}
            </Card>
        </Page>
    );
}
