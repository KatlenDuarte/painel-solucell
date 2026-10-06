// src/screens/FiadoPage.tsx

import { useState, useMemo, useCallback } from "react";
import {
    Search,
    Calendar,
    Clock,
    MessageCircle,
    Check,
    AlertCircle,
    X,
    Wallet,
    Landmark,
    CheckCircle2,
    Users,
    Phone
} from "lucide-react";
import { Page, PageHeader, Card, StatCard, Button, IconButton, Badge, Segmented, SearchInput, EmptyState, LoadingState } from "../components/ui";
import { formatBRL, initials } from "../lib/format";

import {
    updateDoc,
    doc,
    serverTimestamp
} from "../lib/firestore";
import QuitarFiadoModal from "../components/QuitarFiadoModal";

import { db } from "../lib/firebase";
import { useStoreData } from "../contexts/StoreDataContext";

interface FiadoSale {
    id: string;
    clientName: string;
    date: string;
    time: string;
    total: number;
    items: { name: string; qty?: number }[];
    phone?: string;
    note?: string;
    status: string;
    timestamp?: any;
}

export default function FiadoPage() {

    const { sales: salesDocs, salesLoading: loading } = useStoreData();
    const [editingNote, setEditingNote] = useState<Record<string, string>>({});

    const [searchTerm, setSearchTerm] = useState("");

    const [activeTab, setActiveTab] = useState<
        "pendentes" | "historico"
    >("pendentes");
    const [showQuitarModal, setShowQuitarModal] = useState(false);

    const [selectedFiado, setSelectedFiado] =
        useState<FiadoSale | null>(null);

    const [selectedMonth, setSelectedMonth] =
        useState<string>("all");

    // Fiados derivados das vendas em tempo real (StoreDataContext): trocar de aba
    // ou quitar/cancelar um fiado não gera nova leitura da coleção.
    const fiados = useMemo<FiadoSale[]>(() => {
            const statusFilter =
                activeTab === "pendentes"
                    ? "pending"
                    : "fiado_quitado";

            const list: FiadoSale[] = [];

            salesDocs.forEach((docSnap) => {

                const data = docSnap.data();
                if (data.status !== statusFilter) return;

                const isFiado =
                    data.paymentMethod === "Fiado" ||
                    data.paymentMethod === "Fiado (Quitado)" ||
                    data.fiado;

                if (isFiado) {

                    const itemsList = Array.isArray(data.items)
                        ? data.items.map((item: any) => ({
                            name: item.name || "Item",
                            qty:
                                item.saleQty ||
                                item.quantity ||
                                1
                        }))
                        : [{ name: "Serviço", qty: 1 }];

                    list.push({
                        id: docSnap.id,

                        clientName:
                            data.fiado?.nome ||
                            data.clientName ||
                            "Cliente não informado",

                        date:
                            data.timestamp
                                ?.toDate()
                                ?.toLocaleDateString("pt-BR") || "--",

                        time:
                            data.timestamp
                                ?.toDate()
                                ?.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                }) || "--",

                        total:
                            Number(data.total) ||
                            data.fiado?.valor ||
                            0,

                        items: itemsList,

                        phone:
                            data.fiado?.whatsapp ||
                            "",

                        note: data.note || "",

                        status: data.status,

                        timestamp: data.timestamp
                    });
                }

            });

            list.sort(
                (a, b) =>
                    (b.timestamp?.toMillis?.() || 0) -
                    (a.timestamp?.toMillis?.() || 0)
            );

            return list;
    }, [salesDocs, activeTab]);

    // Mantido para os callbacks: o listener já reflete as alterações.
    const fetchFiados = useCallback(() => {}, []);


    const filteredFiados = fiados.filter((f) => {

        const matchesSearch =
            f.clientName
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||

            (f.phone || "")
                .includes(searchTerm);

        if (selectedMonth === "all") {
            return matchesSearch;
        }

        const saleMonth =
            f.timestamp
                ?.toDate()
                ?.toISOString()
                ?.slice(0, 7);

        return (
            matchesSearch &&
            saleMonth === selectedMonth
        );

    });

    const totalPendente = filteredFiados.reduce(
        (acc, cur) => acc + cur.total,
        0
    );

    const handleSaveNote = async (saleId: string) => {
        try {
            await updateDoc(doc(db, "sales", saleId), {
                note: editingNote[saleId]
            });

            alert("Observação salva com sucesso!");

            fetchFiados();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar observação.");
        }
    };

    const handleMarkAsPaid = async (id: string) => {

        if (
            !confirm("Marcar este fiado como pago?")
        ) return;

        try {

            await updateDoc(doc(db, "sales", id), {
                status: "completed",
                paidAt: serverTimestamp(),
                originalPaymentMethod: "Fiado",
                paymentMethod: "Fiado (Quitado)"
            });

            alert("Fiado quitado com sucesso!");

            fetchFiados();

        } catch (e) {

            alert("Erro ao atualizar.");

        }

    };

    const handleCancelFiado = async (id: string) => {

        if (
            !confirm(
                "Tem certeza que deseja CANCELAR este fiado?"
            )
        ) return;

        try {

            await updateDoc(doc(db, "sales", id), {
                status: "cancelled",
                cancelledAt: serverTimestamp()
            });

            alert("Fiado cancelado.");

            fetchFiados();

        } catch (e) {

            alert("Erro ao cancelar.");

        }

    };

    const openQuitarModal = (sale: FiadoSale) => {
        setSelectedFiado(sale);
        setShowQuitarModal(true);
    };

    // Resumo geral (independente da aba)
    const summary = useMemo(() => {
        let pendingCount = 0, pendingTotal = 0, paidCount = 0, oldest = 0;
        const now = Date.now();
        salesDocs.forEach(d => {
            const data = d.data();
            const isFiado = data.paymentMethod === "Fiado" || data.paymentMethod === "Fiado (Quitado)" || data.fiado;
            if (!isFiado) return;
            if (data.status === "pending") {
                pendingCount++;
                pendingTotal += Number(data.total) || Number(data.fiado?.valor) || 0;
                const ms = data.timestamp?.toMillis?.();
                if (ms) oldest = Math.max(oldest, Math.floor((now - ms) / 86400000));
            } else if (data.status === "fiado_quitado") {
                paidCount++;
            }
        });
        return { pendingCount, pendingTotal, paidCount, oldest };
    }, [salesDocs]);

    // Meses disponíveis para o filtro, a partir dos próprios registros
    const monthOptions = useMemo(() => {
        const set = new Set<string>();
        fiados.forEach(f => {
            const d = f.timestamp?.toDate?.();
            if (d) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        });
        return [...set].sort().reverse().map(value => {
            const [y, m] = value.split("-").map(Number);
            const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
        });
    }, [fiados]);

    const daysOpen = (f: FiadoSale) => {
        const ms = f.timestamp?.toMillis?.();
        return ms ? Math.floor((Date.now() - ms) / 86400000) : 0;
    };

    return (
        <Page>
            {showQuitarModal && selectedFiado && (
                <QuitarFiadoModal
                    saleId={selectedFiado.id}
                    total={selectedFiado.total}
                    onClose={() => {
                        setShowQuitarModal(false);
                        setSelectedFiado(null);
                    }}
                    onSuccess={() => {
                        setShowQuitarModal(false);
                        setSelectedFiado(null);
                        fetchFiados();
                    }} clientName={""} />
            )}

            <PageHeader
                title="Fiado"
                description="Controle de vendas a prazo: cobre, registre pagamentos e acompanhe o histórico."
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total a receber" value={formatBRL(summary.pendingTotal)} icon={Wallet} tone="danger" hint="Soma dos fiados em aberto" />
                <StatCard label="Fiados em aberto" value={summary.pendingCount} icon={Users} tone="warning" hint={summary.pendingCount ? `Mais antigo há ${summary.oldest} dias` : "Nenhum pendente"} />
                <StatCard label="Quitados" value={summary.paidCount} icon={CheckCircle2} tone="success" hint="Registros no histórico" />
                <StatCard label={activeTab === "pendentes" ? "Filtrado (pendentes)" : "Filtrado (histórico)"} value={formatBRL(totalPendente)} icon={Landmark} hint={`${filteredFiados.length} registros na lista`} />
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                            value={activeTab}
                            onChange={setActiveTab}
                            options={[
                                { value: "pendentes", label: `Pendentes${summary.pendingCount ? ` · ${summary.pendingCount}` : ""}` },
                                { value: "historico", label: "Histórico" },
                            ]}
                        />
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="ui-input w-auto">
                            <option value="all">Todos os meses</option>
                            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Buscar cliente ou telefone..." className="w-full lg:w-72" />
                </div>

                {loading ? (
                    <LoadingState label="Carregando fiados..." />
                ) : filteredFiados.length === 0 ? (
                    <EmptyState
                        icon={activeTab === "pendentes" ? CheckCircle2 : AlertCircle}
                        title={activeTab === "pendentes" ? "Nenhum fiado pendente" : "Nenhum registro no histórico"}
                        description={searchTerm || selectedMonth !== "all" ? "Ajuste a busca ou o mês selecionado." : activeTab === "pendentes" ? "Todos os clientes estão em dia." : "Fiados quitados aparecem aqui."}
                    />
                ) : (
                    <ul className="divide-y divide-line">
                        {filteredFiados.map((sale) => {
                            const days = daysOpen(sale);
                            const note = editingNote[sale.id] ?? sale.note ?? "";
                            const noteChanged = editingNote[sale.id] !== undefined && editingNote[sale.id] !== sale.note;
                            return (
                                <li key={sale.id} className="p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                        <div className="flex min-w-0 flex-1 gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle border border-line text-sm font-semibold text-fg-muted">
                                                {initials(sale.clientName)}
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-fg">{sale.clientName}</h3>
                                                    {activeTab === "pendentes" ? (
                                                        <Badge tone={days > 30 ? "danger" : days > 7 ? "warning" : "neutral"} dot>
                                                            {days === 0 ? "Hoje" : `${days} ${days === 1 ? "dia" : "dias"} em aberto`}
                                                        </Badge>
                                                    ) : (
                                                        <Badge tone="success" dot>Quitado</Badge>
                                                    )}
                                                </div>
                                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                                                    <span className="inline-flex items-center gap-1"><Calendar size={12} /> {sale.date}</span>
                                                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {sale.time}</span>
                                                    {sale.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {sale.phone}</span>}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {sale.items.map((item, i) => (
                                                        <Badge key={i}><span className="text-fg-subtle">{item.qty}×</span> {item.name}</Badge>
                                                    ))}
                                                </div>
                                                <div className="flex items-start gap-2 pt-1">
                                                    <textarea
                                                        value={note}
                                                        onChange={(e) => setEditingNote((prev) => ({ ...prev, [sale.id]: e.target.value }))}
                                                        placeholder="Observação (ex.: data prevista de pagamento)"
                                                        rows={1}
                                                        className="ui-input h-auto min-h-9 py-2 resize-y text-sm"
                                                    />
                                                    {noteChanged && (
                                                        <Button size="md" onClick={() => handleSaveNote(sale.id)}>Salvar</Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 flex-row items-center justify-between gap-3 lg:flex-col lg:items-end">
                                            <div className="lg:text-right">
                                                <p className="text-xs text-fg-subtle">Valor</p>
                                                <p className={`text-lg font-semibold tabular ${activeTab === "pendentes" ? "text-fg" : "text-fg-muted"}`}>{formatBRL(sale.total)}</p>
                                            </div>
                                            <div className="flex items-center justify-end gap-1.5">
                                                {!!sale.phone && (
                                                    <a
                                                        href={`https://wa.me/${sale.phone.replace(/\D/g, "")}?text=Olá ${encodeURIComponent(sale.clientName)}, passando para lembrar sobre o fiado pendente no valor de R$ ${sale.total.toFixed(2)}.`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title="Cobrar pelo WhatsApp"
                                                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-hover transition-colors"
                                                    >
                                                        <MessageCircle size={15} className="text-success" /> Cobrar
                                                    </a>
                                                )}
                                                {activeTab === "pendentes" && (
                                                    <>
                                                        <Button variant="primary" icon={Check} onClick={() => openQuitarModal(sale)}>Quitar</Button>
                                                        <IconButton icon={X} label="Cancelar fiado" tone="danger" onClick={() => handleCancelFiado(sale.id)} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
        </Page>
    );
}
