import { useMemo, useState } from "react";
import {
    X,
    Wallet,
    Search,
    ArrowLeft,
    Calendar,
    CreditCard,
    DollarSign,
    Smartphone,
    Clock,
    Loader2,
    CheckCircle2,
    AlertCircle,
    User,
    MessageCircle,
    BadgeDollarSign,
    TrendingUp,
    Users,
    TimerReset,
    ReceiptText,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface SaleItem {
    id?: string;
    name: string;
    price: number;
    qty?: number;
    saleQty?: number;
    total?: number;
}

interface FiadoSale {
    id: string;
    timestamp: Timestamp | string | null;
    expectedPaymentDate: Timestamp | string | null;
    items: SaleItem[];
    total: number;
    status: "pending" | "completed";
    clientName: string;
    clientPhone: string;
}

interface FiadoScreenProps {
  onGoBack: () => void;
  fiadoSales: FiadoSale[];
  onRegisterPayment: (saleId: string, paymentMethod: string) => Promise<boolean>;
  onCancelFiado?: (saleId: string) => Promise<void>;
}

const money = (value: number) =>
    value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

function formatTimestamp(ts: any) {
    if (!ts) {
        return { date: "--", time: "", raw: null };
    }

    let d: Date;

    if (ts instanceof Timestamp) {
        d = ts.toDate();
    } else if (typeof ts?.toDate === "function") {
        d = ts.toDate();
    } else if (typeof ts === "string") {
        d = new Date(ts);
    } else if (ts.seconds) {
        d = new Date(ts.seconds * 1000);
    } else {
        return { date: "--", time: "", raw: null };
    }

    if (isNaN(d.getTime())) {
        return { date: "--", time: "", raw: null };
    }

    return {
        date: d.toLocaleDateString("pt-BR"),
        time: d.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        }),
        raw: d,
    };
}

function getDueStatus(expectedPaymentDate: Timestamp | string | null) {
    const parsed = formatTimestamp(expectedPaymentDate);
    if (!parsed.raw) {
        return {
            label: "Sem vencimento",
            className: "bg-slate-800 text-slate-400 border-slate-700",
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(parsed.raw);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
        (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
        return {
            label: `${Math.abs(diffDays)} dia(s) atrasado`,
            className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
    }

    if (diffDays === 0) {
        return {
            label: "Vence hoje",
            className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        };
    }

    return {
        label: `Vence em ${diffDays} dia(s)`,
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
}

interface FiadoPaymentModalProps {
    sale: FiadoSale;
    onClose: () => void;
    onConfirm: (saleId: string, method: string) => Promise<void>;
}

function FiadoPaymentModal({ sale, onClose, onConfirm }: FiadoPaymentModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    const expectedDate = formatTimestamp(sale.expectedPaymentDate);
    const dueStatus = getDueStatus(sale.expectedPaymentDate);

    const handleConfirmPayment = async (method: string) => {
        setIsLoading(true);

        try {
            await onConfirm(sale.id, method);
        } catch (error) {
            console.error("Erro ao registrar pagamento:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const paymentMethods = [
        {
            name: "PIX",
            icon: Smartphone,
            color: "text-emerald-400",
            border: "hover:border-emerald-500/40",
            bg: "hover:bg-emerald-500/10",
        },
        {
            name: "Cartão",
            icon: CreditCard,
            color: "text-blue-400",
            border: "hover:border-blue-500/40",
            bg: "hover:bg-blue-500/10",
        },
        {
            name: "Dinheiro",
            icon: DollarSign,
            color: "text-amber-400",
            border: "hover:border-amber-500/40",
            bg: "hover:bg-amber-500/10",
        },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[#020617] w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/90 z-10">
                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
                        <p className="text-white font-bold text-sm">Processando pagamento...</p>
                    </div>
                )}

                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />

                <button
                    className="absolute right-4 top-4 p-2 text-slate-500 hover:text-white transition disabled:opacity-50"
                    onClick={onClose}
                    disabled={isLoading}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 md:p-8 relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-cyan-400" />
                        </div>

                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">
                                Receber Fiado
                            </h2>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                                Registrar pagamento
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-5">
                        <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-slate-500" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black truncate">{sale.clientName}</p>
                                <p className="text-xs text-slate-500 mt-1">{sale.clientPhone}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3">
                                <p className="text-[9px] uppercase font-black text-slate-500 mb-1">
                                    Vencimento
                                </p>
                                <p className="text-sm font-bold text-slate-200">{expectedDate.date}</p>
                            </div>


                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
                                Valor a receber
                            </p>
                            <p className="text-3xl font-black text-emerald-400 mt-1">
                                {money(sale.total)}
                            </p>
                        </div>
                    </div>

                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                        Método de recebimento
                    </p>

                    <div className="space-y-2.5">
                        {paymentMethods.map((method) => (
                            <button
                                key={method.name}
                                onClick={() => handleConfirmPayment(method.name)}
                                disabled={isLoading}
                                className={`w-full bg-slate-900 border border-slate-800 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-sm ${method.color} ${method.border} ${method.bg} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                <method.icon className="w-4 h-4" />
                                {method.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FiadoScreen({
  onGoBack,
  fiadoSales,
  onRegisterPayment,
  onCancelFiado,
}: FiadoScreenProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [modalSale, setModalSale] = useState<FiadoSale | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quickFilter, setQuickFilter] = useState<
        "all" | "overdue" | "today" | "high"
    >("all");

    const pendingSales = useMemo(
        () => fiadoSales.filter((sale) => sale.status === "pending"),
        [fiadoSales]
    );

    const completedSales = useMemo(
        () => fiadoSales.filter((sale) => sale.status === "completed"),
        [fiadoSales]
    );

    const filteredSales = useMemo(() => {
        const s = searchTerm.toLowerCase().trim();

        return pendingSales
            .filter((sale) => {
                const matchesSearch =
                    sale.clientName.toLowerCase().includes(s) ||
                    sale.clientPhone.includes(s) ||
                    sale.id.includes(s);

                if (!matchesSearch) return false;

                const parsed = formatTimestamp(sale.expectedPaymentDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const due = parsed.raw ? new Date(parsed.raw) : null;
                due?.setHours(0, 0, 0, 0);

                if (quickFilter === "overdue") {
                    return due ? due.getTime() < today.getTime() : false;
                }

                if (quickFilter === "today") {
                    return due ? due.getTime() === today.getTime() : false;
                }

                if (quickFilter === "high") {
                    return sale.total >= 500;
                }

                return true;
            })
            .sort((a, b) => {
                const dateA = formatTimestamp(a.expectedPaymentDate).raw?.getTime() || 0;
                const dateB = formatTimestamp(b.expectedPaymentDate).raw?.getTime() || 0;
                return dateA - dateB;
            });
    }, [pendingSales, searchTerm, quickFilter]);

    const totalPending = pendingSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalCompleted = completedSales.reduce((sum, sale) => sum + sale.total, 0);
    const averageTicket =
        pendingSales.length > 0 ? totalPending / pendingSales.length : 0;

    const overdueCount = pendingSales.filter((sale) => {
        const due = formatTimestamp(sale.expectedPaymentDate).raw;
        if (!due) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const d = new Date(due);
        d.setHours(0, 0, 0, 0);

        return d.getTime() < today.getTime();
    }).length;

    const openPaymentModal = (sale: FiadoSale) => {
        setError(null);
        setModalSale(sale);
    };

    const closeModal = () => setModalSale(null);

    const handleConfirmPayment = async (saleId: string, method: string) => {
        setIsProcessingPayment(true);
        setError(null);

        try {
            const success = await onRegisterPayment(saleId, method);

            if (success) {
                closeModal();
            } else {
                setError("Ocorreu um erro ao finalizar o pagamento. Tente novamente.");
            }
        } catch (err) {
            console.error("Erro fatal ao processar pagamento:", err);
            setError("Falha na comunicação com o servidor. Verifique sua conexão.");
        } finally {
            setIsProcessingPayment(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans antialiased">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-800 pb-6">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={onGoBack}
                            className="h-11 w-11 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                Contas a Receber
                            </h1>

                            <p className="text-xs text-slate-500 mt-1">
                                Gerencie pagamentos de clientes fiado.
                            </p>


                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-3 lg:ml-auto w-fit">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            Total em aberto
                        </p>

                        <p className="text-xl font-black text-emerald-400 mt-1">
                            {money(totalPending)}
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
                        <BadgeDollarSign className="absolute right-4 top-4 text-emerald-500/10" size={42} />
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Total Pendente
                        </p>
                        <p className="text-xl md:text-2xl font-black text-emerald-400">
                            {money(totalPending)}
                        </p>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
                        <Users className="absolute right-4 top-4 text-cyan-500/10" size={42} />
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Clientes
                        </p>
                        <p className="text-2xl font-black text-white">{pendingSales.length}</p>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 relative overflow-hidden">
                        <TrendingUp className="absolute right-4 top-4 text-blue-500/10" size={42} />
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Ticket Médio
                        </p>
                        <p className="text-xl md:text-2xl font-black text-white">
                            {money(averageTicket)}
                        </p>
                    </div>

                    <div className="bg-rose-600/10 p-5 rounded-xl border border-rose-500/20 relative overflow-hidden">
                        <TimerReset className="absolute right-4 top-4 text-rose-500/20" size={42} />
                        <p className="text-rose-400 text-[9px] font-black uppercase mb-2">
                            Atrasados
                        </p>
                        <p className="text-2xl font-black text-white">{overdueCount}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                    <div className="relative">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                            size={18}
                        />

                        <input
                            type="text"
                            placeholder="Buscar cliente, telefone ou ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500 transition"
                        />
                    </div>

                    <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl overflow-x-auto">
                        {[
                            { id: "all", label: "TODOS" },
                            { id: "overdue", label: "ATRASADOS" },
                            { id: "today", label: "HOJE" },
                            { id: "high", label: "+ R$500" },
                        ].map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => setQuickFilter(filter.id as any)}
                                className={`px-4 py-3 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${quickFilter === filter.id
                                        ? "bg-white text-slate-950"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-bold">{error}</span>
                        </div>

                        <button
                            onClick={() => setError(null)}
                            className="text-rose-300 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {filteredSales.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-16 text-center">
                        <CheckCircle2 size={50} className="mx-auto text-emerald-500 mb-4" />

                        <p className="text-white font-black text-lg">
                            Nenhuma dívida encontrada.
                        </p>

                        <p className="text-slate-500 text-sm mt-2">
                            Não existem fiados pendentes para os filtros selecionados.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSales.map((sale) => {
                            const saleDate = formatTimestamp(sale.timestamp);
                            const expectedDate = formatTimestamp(sale.expectedPaymentDate);
                            const dueStatus = getDueStatus(sale.expectedPaymentDate);

                            const whatsappNumber = sale.clientPhone.replace(/\D/g, "");
                            const whatsappText = encodeURIComponent(
                                `Olá ${sale.clientName}, passando para lembrar sobre o fiado pendente no valor de ${money(
                                    sale.total
                                )}.`
                            );

                            return (
                                <div
                                    key={sale.id}
                                    className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/20 transition-all"
                                >
                                    <div className="flex flex-col xl:flex-row gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                                <div className="flex gap-3">
                                                    <div className="h-11 w-11 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                                                        <User className="text-slate-500" size={18} />
                                                    </div>

                                                    <div>
                                                        <h3 className="text-base font-bold text-white tracking-tight">
                                                            {sale.clientName}
                                                        </h3>

                                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                                <Smartphone size={10} />
                                                                {sale.clientPhone || "Sem telefone"}
                                                            </div>

                                                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                                <Calendar size={10} />
                                                                Venda: {saleDate.date}
                                                            </div>

                                                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                                <Clock size={10} />
                                                                {saleDate.time}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-left md:text-right">
                                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">
                                                        Valor Devido
                                                    </p>

                                                    <p className="text-2xl font-black text-emerald-400 font-mono">
                                                        {money(sale.total)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-3">
                                                    <p className="text-[9px] uppercase font-black text-slate-500 mb-1">
                                                        Vencimento
                                                    </p>
                                                    <p className="text-sm text-white font-bold">
                                                        {expectedDate.date}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-950/40 border border-slate-800/50 rounded-lg p-3">
                                                    <p className="text-[9px] uppercase font-black text-slate-500 mb-1">
                                                        Itens
                                                    </p>
                                                    <p className="text-sm text-white font-bold">
                                                        {sale.items.length} produto(s)
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5">
                                                {sale.items.map((item, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-slate-950 border border-slate-800/50 rounded px-2.5 py-1 text-[10px] text-slate-400 font-medium flex items-center gap-1"
                                                    >
                                                        <ReceiptText size={10} className="text-cyan-500" />
                                                        <span className="text-cyan-500 font-bold">
                                                          {item.saleQty || item.qty || 1}x
                                                        </span>
                                                        {item.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="xl:w-60 flex flex-col gap-2 justify-center shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800/60 pt-4 xl:pt-0 xl:pl-4">
                                            <button
                                                onClick={() => openPaymentModal(sale)}
                                                disabled={isProcessingPayment}
                                                className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg py-2.5 font-bold text-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Wallet size={14} />
                                                REGISTRAR PAGAMENTO
                                            </button>

                                            {!!sale.clientPhone && (
                                                <a
                                                    href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-2 font-bold text-slate-400 flex items-center justify-center gap-1.5 transition-all text-[11px]"
                                                >
                                                    <MessageCircle className="text-emerald-500" size={13} />
                                                    COBRAR NO WHATSAPP
                                                </a>

                                                
                                            )}

                                            {onCancelFiado && (
  <button
    onClick={() => onCancelFiado(sale.id)}
    disabled={isProcessingPayment}
    className="w-full bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 rounded-lg py-2 font-bold text-slate-500 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all text-[11px] disabled:opacity-50"
  >
    <X size={13} />
    CANCELAR FIADO
  </button>
)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                            Já recebidos
                        </p>
                        <p className="text-lg font-black text-white mt-1">
                            {money(totalCompleted)}
                        </p>
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                            Histórico pago
                        </p>
                        <p className="text-lg font-black text-white mt-1">
                            {completedSales.length} venda(s)
                        </p>
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                            Resultado do filtro
                        </p>
                        <p className="text-lg font-black text-white mt-1">
                            {filteredSales.length} fiado(s)
                        </p>
                    </div>
                </div>
            </div>

            {modalSale && (
                <FiadoPaymentModal
                    sale={modalSale}
                    onClose={closeModal}
                    onConfirm={handleConfirmPayment}
                />
            )}
        </div>
    );
}