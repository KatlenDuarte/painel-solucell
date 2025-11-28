import React, { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Search,
    Calendar,
    CreditCard,
    Smartphone,
    DollarSign,
    Clock,
    Undo2,
    BookOpenText,
    User,
    Phone,
    Wrench // 💡 NOVO: Importa Wrench para o ícone de manutenção
} from "lucide-react";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Importa os modais e telas
import RefundConfirmationModal from "../components/RefundConfirmationModal";
import NewSaleModal from "../components/NewSaleModal";
import FiadoScreen from "../components/FiadoSalesModal";

// --- Interfaces (Tipagem) ---
interface SaleItem {
    id: string;
    name: string;
    saleQty: number;
    price: number;
}

interface DistributedPayment {
    method: string;
    value: number;
}

interface Sale {
    id: string;
    date: string;
    time: string;
    items: SaleItem[];
    total: number;
    payment: string; // Ex: PIX, Dinheiro, Múltiplo, Fiado, Cartão (Chave de exibição)
    status: "completed" | "pending" | "refunded";
    dateObject?: Date;
}

interface SaleWithClient extends Sale {
    clientName?: string;
    clientPhone?: string;
    distributedPayments?: DistributedPayment[];
    maintenanceId?: string;
    // O campo 'paymentMethod' é usado pelo service de Manutenção, mas 'payment' é o principal
    paymentMethod?: string; 
}

interface SalesProps {
    storeEmail: string;
}

// --- Funções Utilitárias para Data (Fora do Componente) ---
const isToday = (date: Date) => {
    const today = new Date();
    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
};

const isThisWeek = (date: Date) => {
    const now = new Date();
    const dayOfWeek = now.getDay(); 
    const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dayOfWeek
    );
    const endOfWeek = new Date(
        startOfWeek.getFullYear(),
        startOfWeek.getMonth(),
        startOfWeek.getDate() + 6,
        23,
        59,
        59,
        999
    );
    return date >= startOfWeek && date <= endOfWeek;
};

const isThisMonth = (date: Date) => {
    const now = new Date();
    return (
        date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    );
};

// 💡 FUNÇÃO DE NORMALIZAÇÃO
// Remove acentos e padroniza para evitar erros de comparação (Cartão vs Cartao)
const normalizePaymentMethod = (method: string): string => {
    if (!method) return "Outro";
    return method
        .normalize("NFD") // Remove acentos e transforma em caracteres simples
        .replace(/[\u0300-\u036f]/g, "") 
        .trim();
};

export default function Sales({ storeEmail }: SalesProps) {
    const [filter, setFilter] = useState<"all" | "today" | "week" | "month">("today");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
    const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
    const [viewMode, setViewMode] = useState<"sales" | "fiado">("sales");

    const [sales, setSales] = useState<SaleWithClient[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // --- Função de Busca de Dados ---
    const fetchSalesFromFirestore = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(
                collection(db, "sales"),
                where("store", "==", storeEmail)
            );

            const snapshot = await getDocs(q);

            const list: SaleWithClient[] = snapshot.docs
                .map((doc) => {
                    const data = doc.data() as any;
                    const ts = data.timestamp?.toDate();

                    const status: Sale["status"] =
                        data.status || (data.isFiado ? "pending" : "completed");

                    return {
                        id: doc.id,
                        dateObject: ts,
                        date: ts ? ts.toLocaleDateString("pt-BR") : "--/--/----",
                        time: ts
                            ? ts.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                            : "--:--",
                        items: data.items || [],
                        total: Number(data.total) || 0,
                        // 💡 AJUSTE AQUI: Prioriza 'payment' ou 'paymentMethod'
                        payment: data.payment || data.paymentMethod || "PIX", 
                        status,
                        clientName: data.clientName,
                        clientPhone: data.clientPhone,
                        distributedPayments: data.distributedPayments || [],
                        maintenanceId: data.maintenanceId,
                    };
                })
                .filter((sale) => sale.status !== "refunded")
                .sort((a, b) => {
                    if (!a.dateObject || !b.dateObject) return 0;
                    return b.dateObject.getTime() - a.dateObject.getTime();
                });

            setSales(list);
        } catch (error) {
            console.error("Erro ao carregar vendas:", error);
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);


    // --- Efeito de Carregamento Inicial ---
    useEffect(() => {
        fetchSalesFromFirestore();
    }, [fetchSalesFromFirestore]);

    // ... (restante da lógica de filtro e busca - mantida) ...

    const filterSalesByPeriod = (salesList: SaleWithClient[]) => {
        // ... (código existente) ...
        return salesList.filter((sale) => {
            const date = sale.dateObject as Date | undefined;
            if (!date) return false;
    
            switch (filter) {
                case "today":
                    return isToday(date);
                case "week":
                    return isThisWeek(date);
                case "month":
                    return isThisMonth(date);
                case "all":
                default:
                    return true;
            }
        });
    };

    const fiadoPendingSales = sales.filter(
        (sale) => sale.payment.toLowerCase() === "fiado" && sale.status === "pending"
    );

    const fiadoPendingCount = fiadoPendingSales.length;
    const fiadoPendingTotal = fiadoPendingSales.reduce((sum, s) => sum + s.total, 0);

    const salesByPeriod = filterSalesByPeriod(sales);

    const finalFilteredSales = salesByPeriod.filter((sale) => {
        const search = searchTerm.toLowerCase();

        const matchesItemName = sale.items.some((item) =>
            item.name.toLowerCase().includes(search)
        );

        const matchesTotal = sale.total.toFixed(2).includes(search.replace(',', '.')); 

        const matchesClientName = sale.clientName
            ? sale.clientName.toLowerCase().includes(search)
            : false;

        const matchesPayment = sale.payment.toLowerCase().includes(search);

        return (
            search === "" ||
            matchesItemName ||
            matchesTotal ||
            matchesClientName ||
            matchesPayment
        );
    });

    // --- Cálculo de Estatísticas por Pagamento (Cards) ---
    // 💡 AJUSTE AQUI: Usamos chaves NORMALIZADAS (sem acento) no mapeamento interno
    const paymentStatsMap: Record<string, { count: number; total: number }> = {
        PIX: { count: 0, total: 0 },
        Cartao: { count: 0, total: 0 }, // 'Cartao' sem acento
        Dinheiro: { count: 0, total: 0 },
        Fiado: { count: 0, total: 0 },
        Outro: { count: 0, total: 0 }, 
    };

    salesByPeriod.forEach((sale) => {
        const status = sale.status;
        const rawPayment = sale.payment;

        // Apenas considera vendas completas e Fiado pendente
        if (status === "completed" || (rawPayment.toLowerCase() === "fiado" && status === "pending")) {
            
            // 💡 NOVO: Normaliza o método de pagamento
            const normalizedPayment = normalizePaymentMethod(rawPayment);


            if (normalizedPayment === 'Multiplo' && sale.distributedPayments && sale.distributedPayments.length > 0) {
                // 1. Distribui o valor para os métodos
                sale.distributedPayments.forEach(dp => {
                    const normalizedDpMethod = normalizePaymentMethod(dp.method);
                    
                    const methodKey = normalizedDpMethod in paymentStatsMap ? normalizedDpMethod : 'Outro';
                    paymentStatsMap[methodKey].total += dp.value;
                });
                // 2. Conta a venda na categoria 'Outro'
                paymentStatsMap['Outro'].count += 1;

            } else {
                // Se for pagamento ÚNICO ou Manutenção Paga
                // 💡 AJUSTE AQUI: Usa a chave normalizada para procurar no mapa
                const methodKey = normalizedPayment in paymentStatsMap ? normalizedPayment : 'Outro';
                
                paymentStatsMap[methodKey].count += 1;
                paymentStatsMap[methodKey].total += sale.total;
            }
        }
    });


    // Corrige Fiado nos cards para mostrar apenas os pendentes
    paymentStatsMap["Fiado"].count = fiadoPendingCount;
    paymentStatsMap["Fiado"].total = fiadoPendingTotal;
    
    // 💡 AJUSTE AQUI: Usa a chave normalizada para buscar os totais, mas exibe o nome correto
    const paymentStats = [
        {
            method: "PIX",
            icon: Smartphone,
            count: paymentStatsMap["PIX"].count,
            total: paymentStatsMap["PIX"].total,
            color: "emerald",
        },
        {
            // ⚠️ Importante: O display é "Cartão", mas a busca é por "Cartao"
            method: "Cartão", 
            icon: CreditCard,
            count: paymentStatsMap["Cartao"].count,
            total: paymentStatsMap["Cartao"].total,
            color: "blue",
        },
        {
            method: "Dinheiro",
            icon: DollarSign,
            count: paymentStatsMap["Dinheiro"].count,
            total: paymentStatsMap["Dinheiro"].total,
            color: "amber",
        },
        {
            method: "Fiado",
            icon: BookOpenText,
            count: fiadoPendingCount,
            total: fiadoPendingTotal,
            color: "red",
        },
    ];

    const getPaymentColor = (method: string) => {
        // ... (código existente) ...
        switch (normalizePaymentMethod(method)) { // Usa a função de normalização aqui também!
            case "PIX":
            case "Cartao": // Normalizado
            case "Dinheiro": // Normalizado
            case "Multiplo":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "Fiado":
                return "bg-red-500/10 text-red-400 border-red-500/20";
            default:
                return "bg-slate-500/10 text-slate-400 border-slate-500/20";
        }
    };

    // ... (restante dos handlers - mantidos) ...
    const handleRefundRequest = (saleId: string) => {
        setRefundSaleId(saleId);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setRefundSaleId(null);
    };

    const handleOpenNewSaleModal = () => {
        setIsNewSaleModal(true);
    };

    const handleCloseNewSaleModal = () => {
        setIsNewSaleModal(false);
        fetchSalesFromFirestore();
    };

    const handleRegisterPayment = (saleId: string, paymentMethod: string) => {
        setSales((prevSales) =>
            prevSales.map((sale) =>
                sale.id === saleId
                    ? { ...sale, status: "completed", payment: paymentMethod }
                    : sale
            )
        );
        fetchSalesFromFirestore();
    };

    const handleRefundSuccess = (refundedSaleId: string) => {
        fetchSalesFromFirestore();
    };

    // --- Renderização da Tela Fiado ---
    if (viewMode === "fiado") {
        return (
            <FiadoScreen
                onGoBack={() => setViewMode("sales")}
                fiadoSales={fiadoPendingSales}
                onRegisterPayment={handleRegisterPayment}
            />
        );
    }

    // --- Renderização da Tela Principal de Vendas ---
    return (
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 bg-slate-950 min-h-screen">
            {/* Modais */}
            <RefundConfirmationModal
                saleId={refundSaleId}
                onClose={handleCloseModal}
                onRefundSuccess={handleRefundSuccess}
            />

            {isNewSaleModalOpen && (
                <NewSaleModal
                    onClose={handleCloseNewSaleModal}
                    storeEmail={storeEmail}
                    onSaleComplete={async () => {
                        await fetchSalesFromFirestore();
                    }}
                />
            )}

            {/* Título e Botões de Ação */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Vendas 🚀</h1>
                    <p className="text-slate-400 text-xs sm:text-sm">Gerencie e registre todas as vendas</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                    <button
                        onClick={() => setViewMode("fiado")}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all font-medium border border-red-500/30 w-full"
                        title="Ver Contas a Receber"
                    >
                        <BookOpenText className="w-5 h-5" />
                        Fiado ({fiadoPendingCount})
                    </button>

                    <button
                        onClick={handleOpenNewSaleModal}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/20 w-full"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Venda
                    </button>
                </div>
            </div>

            <hr className="my-4 sm:my-6 border-slate-800" />

            {/* Payment Stats (Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {paymentStats.map((stat) => {
                    const Icon = stat.icon;
                    const colorMap: Record<string, string> = {
                        emerald: 'emerald',
                        blue: 'blue',
                        amber: 'amber',
                        red: 'red',
                        slate: 'slate',
                    };
                    const baseColor = colorMap[stat.color] || 'slate';

                    return (
                        <div
                            key={stat.method}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all shadow-md"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-8 h-8 rounded-md flex items-center justify-center 
                                            ${baseColor === 'emerald' ? 'bg-emerald-500/10' :
                                                baseColor === 'blue' ? 'bg-blue-500/10' :
                                                    baseColor === 'amber' ? 'bg-amber-500/10' :
                                                        baseColor === 'red' ? 'bg-red-500/10' :
                                                            'bg-slate-500/10'}`}
                                    >
                                        <Icon className={`w-4 h-4 ${baseColor === 'emerald' ? 'text-emerald-500' :
                                            baseColor === 'blue' ? 'text-blue-500' :
                                                baseColor === 'amber' ? 'text-amber-500' :
                                                    baseColor === 'red' ? 'text-red-500' :
                                                        'text-slate-500'}`} />
                                    </div>
                                    <h3 className="text-slate-300 text-sm font-semibold">{stat.method}</h3>
                                </div>
                                <span className="text-slate-400 text-xs">{stat.count} vendas</span>
                            </div>
                            <p className="text-white text-xl font-bold">
                                R${" "}
                                {stat.total.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                })}
                            </p>
                        </div>
                    );
                })}
            </div>

            <hr className="my-4 sm:my-6 border-slate-800" />

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {/* Botões de Filtro de Período */}
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-2 sm:pb-0">
                    {["all", "today", "week", "month"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex-shrink-0 ${filter === f
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                                }`}
                        >
                            {f === "all"
                                ? "Todas"
                                : f === "today"
                                    ? "Hoje"
                                    : f === "week"
                                        ? "Esta Semana"
                                        : "Este Mês"}
                        </button>
                    ))}
                </div>

                <div className="flex-1 hidden sm:block" />

                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar venda, cliente, produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                    />
                </div>
            </div>

            <hr className="my-4 sm:my-6 border-slate-800" />

            {/* Sales List */}
            <div className="space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                    {isLoading ? "Carregando Transações..." : `Últimas Transações (${finalFilteredSales.length} resultados)`}
                </h2>

                {isLoading && (
                    <p className="text-slate-500 text-center py-10">
                        Aguarde, carregando dados do Firestore...
                    </p>
                )}

                {!isLoading && finalFilteredSales.length === 0 && (
                    <p className="text-slate-500 text-center py-10">Nenhuma venda encontrada para o período e busca selecionados.</p>
                )}

                {!isLoading && finalFilteredSales.map((sale) => (
                    <div
                        key={sale.id}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all relative"
                    >
                        {/* Informações da Venda (Topo) */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3 sm:gap-0">

                            {/* Data e Ícone */}
                            <div className="flex items-center gap-4">
                                <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center 
                                        ${sale.payment === 'Fiado' && sale.status === 'pending'
                                            ? 'bg-red-500/10'
                                            : sale.maintenanceId
                                                ? 'bg-blue-500/10' // ÍCONE DE MANUTENÇÃO
                                                : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}
                                >
                                    {sale.payment === 'Fiado' && sale.status === 'pending'
                                        ? <BookOpenText className="w-5 h-5 text-red-400" />
                                        : sale.maintenanceId
                                            ? <Wrench className="w-5 h-5 text-blue-400" /> // 💡 NOVO ÍCONE
                                            : <DollarSign className="w-5 h-5 text-white" />
                                    }
                                </div>

                                <div>
                                    <div className="flex flex-col text-sm">
                                        <span className="flex items-center gap-2 text-white font-medium text-sm">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            {sale.date}
                                        </span>
                                        <span className="flex items-center gap-2 text-slate-400 text-xs mt-0.5">
                                            <Clock className="w-4 h-4" />
                                            {sale.time}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Total e Status/Ações */}
                            <div className="text-left sm:text-right mt-3 sm:mt-0 w-full sm:w-auto">
                                <div className="flex items-center gap-2 mb-1 justify-between sm:justify-end">
                                    {/* Botão de reembolso (apenas para vendas completas e não Fiado) */}
                                    {sale.payment !== "Fiado" && sale.status === 'completed' && (
                                        <button
                                            onClick={() => handleRefundRequest(sale.id)}
                                            className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                            title="Solicitar Reembolso"
                                        >
                                            <Undo2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <p className="text-emerald-400 font-medium text-lg">
                                        R$ {sale.total.toFixed(2).replace('.', ',')}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 justify-start sm:justify-end mt-1">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPaymentColor(
                                            sale.payment
                                        )}`}
                                    >
                                        {sale.payment}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Informações do Cliente Fiado (Destaque) */}
                        {sale.payment === "Fiado" && sale.clientName && (
                            <div className="bg-red-900/10 border-t border-red-700/50 pt-2 pb-1 px-4 my-3 mx-[-1rem] rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                                <span className="flex items-center gap-2 text-red-300 text-sm font-medium">
                                    <User className="w-4 h-4" />
                                    Cliente: {sale.clientName}
                                </span>
                                <span className="flex items-center gap-2 text-red-300 text-sm">
                                    <Phone className="w-4 h-4" />
                                    {sale.clientPhone}
                                </span>
                            </div>
                        )}

                        {/* 💡 NOVO: Informações de Venda de Manutenção (Destaque) */}
                        {sale.maintenanceId && (
                            <div className="bg-blue-900/10 border-t border-blue-700/50 pt-2 pb-1 px-4 my-3 mx-[-1rem] rounded-md flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-blue-300" />
                                <span className="text-blue-300 text-sm font-medium">
                                    Venda de Serviço (Manutenção OS #{sale.maintenanceId.substring(0, 8)}...)
                                </span>
                            </div>
                        )}


                        {/* Itens da Venda */}
                        <div className="border-t border-slate-800 pt-3">
                            <div className="space-y-1">
                                {sale.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300 truncate pr-2">
                                            {item.saleQty}x {item.name}
                                        </span>
                                        <span className="text-white font-medium flex-shrink-0">
                                            R$ {item.price.toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <hr className="my-4 sm:my-6 border-slate-800" />

            {/* Resumo Final */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-4 sm:p-5 mt-4 sm:mt-6 shadow-xl">
                <h2 className="text-lg sm:text-xl font-bold text-emerald-300 mb-3 sm:mb-4">
                    Resumo do Período ({filter === "all" ? "Todas" : filter === "today" ? "Hoje" : filter === "week" ? "Esta Semana" : "Este Mês"})
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                    <div>
                        <p className="text-slate-400 text-xs sm:text-sm uppercase">Vendas Concluídas</p>
                        <p className="text-xl font-extrabold text-white mt-1">{salesByPeriod.filter(s => s.status === 'completed' || s.status === 'pending').length}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs sm:text-sm uppercase">Valor Total (Vendas)</p>
                        <p className="text-xl font-extrabold text-white mt-1">R$ {salesByPeriod.reduce((sum, s) => sum + s.total, 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs sm:text-sm uppercase">Ticket Médio</p>
                        <p className="text-xl font-extrabold text-white mt-1">
                            R$ {(salesByPeriod.length > 0 ? (salesByPeriod.reduce((sum, s) => sum + s.total, 0) / salesByPeriod.length) : 0).toFixed(2).replace('.', ',')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}