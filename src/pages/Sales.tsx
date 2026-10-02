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
  Wrench,
} from "lucide-react";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

import RefundConfirmationModal from "../components/RefundConfirmationModal";
import NewSaleModal from "../components/NewSaleModal";
import FiadoScreen from "../components/FiadoSalesModal";

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
  payment: string;
  status: "completed" | "pending" | "refunded" | "cancelled";
  dateObject?: Date;
}

interface SaleWithClient extends Sale {
  clientName?: string;
  clientPhone?: string;
  distributedPayments?: DistributedPayment[];
  maintenanceId?: string;
  paymentMethod?: string;
  timestamp?: any;
  expectedPaymentDate?: any;
}

interface SalesProps {
  storeEmail: string;
}

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
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

const normalizePaymentMethod = (method: string): string => {
  if (!method) return "Outro";
  return method.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export default function Sales({ storeEmail }: SalesProps) {
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">(
    "today"
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
  const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
  const [viewMode, setViewMode] = useState<"sales" | "fiado">("sales");

  const [sales, setSales] = useState<SaleWithClient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchSalesFromFirestore = useCallback(async () => {
    setIsLoading(true);

    try {
      const q = query(collection(db, "sales"), where("store", "==", storeEmail));
      const snapshot = await getDocs(q);

      const list: SaleWithClient[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as any;
          const ts = data.timestamp?.toDate?.();

          const status: Sale["status"] =
            data.status || (data.isFiado ? "pending" : "completed");

          return {
            id: docSnap.id,
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
            payment: data.payment || data.paymentMethod || "PIX",
            status,
            clientName: data.clientName || data.fiado?.nome || "",
            clientPhone: data.clientPhone || data.fiado?.whatsapp || "",
            distributedPayments: data.distributedPayments || [],
            maintenanceId: data.maintenanceId,
            paymentMethod: data.paymentMethod,
            timestamp: data.timestamp || data.createdAt || null,
            expectedPaymentDate:
              data.expectedPaymentDate || data.fiado?.data || null,
          };
        })
        .filter(
          (sale) => sale.status !== "refunded" && sale.status !== "cancelled"
        )
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

  useEffect(() => {
    fetchSalesFromFirestore();
  }, [fetchSalesFromFirestore]);

  const filterSalesByPeriod = (salesList: SaleWithClient[]) => {
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

  const handleCancelFiado = async (saleId: string) => {
    const confirmCancel = confirm(
      "Cancelar esta venda fiada? Ela sairá da lista de pendentes."
    );

    if (!confirmCancel) return;

    try {
      const saleRef = doc(db, "sales", saleId);

      await updateDoc(saleRef, {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "Desistência do cliente",
      });

      await fetchSalesFromFirestore();
    } catch (error) {
      console.error("Erro ao cancelar fiado:", error);
      alert("Erro ao cancelar venda fiada.");
    }
  };

  const fiadoPendingSales = sales.filter(
    (sale) =>
      normalizePaymentMethod(sale.payment) === "Fiado" &&
      sale.status === "pending"
  );

  const fiadoPendingCount = fiadoPendingSales.length;
  const fiadoPendingTotal = fiadoPendingSales.reduce(
    (sum, s) => sum + s.total,
    0
  );

  // IMPORTANTE:
  // Apenas vendas completed entram nos cards, lista principal e resumo.
  // Fiado pending fica somente na tela de Fiado.
  const completedSales = sales.filter((sale) => sale.status === "completed");
  const salesByPeriod = filterSalesByPeriod(completedSales);

  const finalFilteredSales = salesByPeriod.filter((sale) => {
    const search = searchTerm.toLowerCase();

    const matchesItemName = sale.items.some((item) =>
      item.name.toLowerCase().includes(search)
    );

    const matchesTotal = sale.total.toFixed(2).includes(search.replace(",", "."));

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

  const paymentStatsMap: Record<string, { count: number; total: number }> = {
    PIX: { count: 0, total: 0 },
    Cartao: { count: 0, total: 0 },
    Dinheiro: { count: 0, total: 0 },
    Fiado: { count: 0, total: 0 },
    Outro: { count: 0, total: 0 },
  };

  salesByPeriod.forEach((sale) => {
    if (sale.status !== "completed") return;

    const rawPayment = sale.payment;
    const normalizedPayment = normalizePaymentMethod(rawPayment);

    if (
      normalizedPayment === "Multiplo" &&
      sale.distributedPayments &&
      sale.distributedPayments.length > 0
    ) {
      sale.distributedPayments.forEach((dp) => {
        const normalizedDpMethod = normalizePaymentMethod(dp.method);
        const methodKey =
          normalizedDpMethod in paymentStatsMap ? normalizedDpMethod : "Outro";

        paymentStatsMap[methodKey].total += Number(dp.value) || 0;
      });

      paymentStatsMap.Outro.count += 1;
    } else {
      const methodKey =
        normalizedPayment in paymentStatsMap ? normalizedPayment : "Outro";

      paymentStatsMap[methodKey].count += 1;
      paymentStatsMap[methodKey].total += sale.total;
    }
  });

  // Aqui continua mostrando o botão Fiado com pendentes,
  // mas NÃO entra como faturamento do dia.
  const paymentStats = [
    {
      method: "PIX",
      icon: Smartphone,
      count: paymentStatsMap.PIX.count,
      total: paymentStatsMap.PIX.total,
      color: "emerald",
    },
    {
      method: "Cartão",
      icon: CreditCard,
      count: paymentStatsMap.Cartao.count,
      total: paymentStatsMap.Cartao.total,
      color: "blue",
    },
    {
      method: "Dinheiro",
      icon: DollarSign,
      count: paymentStatsMap.Dinheiro.count,
      total: paymentStatsMap.Dinheiro.total,
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
    switch (normalizePaymentMethod(method)) {
      case "PIX":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Cartao":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Dinheiro":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Multiplo":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Fiado":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

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

  const handleRegisterPayment = async (
    saleId: string,
    paymentMethod: string
  ): Promise<boolean> => {
    try {
      const saleRef = doc(db, "sales", saleId);

      await updateDoc(saleRef, {
        status: "completed",
        payment: paymentMethod,
        paymentMethod,
        paidAt: serverTimestamp(),

        // importante:
        // ao quitar o fiado, a venda passa a contar no dia do pagamento
        timestamp: serverTimestamp(),
      });

      await fetchSalesFromFirestore();
      return true;
    } catch (error) {
      console.error("Erro ao registrar pagamento do fiado:", error);
      return false;
    }
  };

  const handleRefundSuccess = () => {
    fetchSalesFromFirestore();
  };

  const periodLabel =
    filter === "all"
      ? "Todas"
      : filter === "today"
      ? "Hoje"
      : filter === "week"
      ? "Esta Semana"
      : "Este Mês";

  if (viewMode === "fiado") {
    return (
      <FiadoScreen
        onGoBack={() => setViewMode("sales")}
        fiadoSales={fiadoPendingSales}
        onRegisterPayment={handleRegisterPayment}
        onCancelFiado={handleCancelFiado}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans antialiased">
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

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-5 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                Painel Operacional
              </span>

              <span className="bg-slate-950 text-slate-500 text-[9px] font-black px-2.5 py-0.5 rounded border border-slate-800/80 uppercase tracking-widest">
                Vendas
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white">
              Vendas<span className="text-emerald-500">.</span>
            </h1>

            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Gerencie vendas, fiados, manutenções e formas de pagamento.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start lg:self-end w-full sm:w-auto">
            <button
              onClick={() => setViewMode("fiado")}
              className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-black text-red-400 transition-all active:scale-[0.97]"
            >
              <BookOpenText size={14} />
              Fiado ({fiadoPendingCount})
            </button>

            <button
              onClick={handleOpenNewSaleModal}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-500 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] shadow-sm"
            >
              <Plus size={16} strokeWidth={2.5} />
              Nova Venda
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {paymentStats.map((stat) => {
            const Icon = stat.icon;

            const iconClass =
              stat.color === "emerald"
                ? "text-emerald-500"
                : stat.color === "blue"
                ? "text-blue-500"
                : stat.color === "amber"
                ? "text-amber-500"
                : "text-red-500";

            const activeBg =
              stat.color === "emerald"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : stat.color === "blue"
                ? "bg-blue-500/10 border-blue-500/20"
                : stat.color === "amber"
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-red-500/10 border-red-500/20";

            return (
              <div
                key={stat.method}
                className="text-left p-4 sm:p-5 rounded-xl border transition-all flex flex-col justify-between bg-slate-900/50 border-slate-800 hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center ${activeBg}`}
                      >
                        <Icon className={iconClass} size={14} />
                      </div>

                      <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                        {stat.method}
                      </p>
                    </div>

                    <span className="text-[9px] font-black text-slate-600 uppercase">
                      {stat.count} vendas
                    </span>
                  </div>

                  <p className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {formatCurrency(stat.total)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-center">
          <div className="flex flex-wrap sm:flex-nowrap bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto shrink-0">
            {(["today", "week", "month"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all ${
                  filter === f
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f === "today" ? "HOJE" : f === "week" ? "SEMANA" : "MÊS"}
              </button>
            ))}
          </div>

          <div className="relative w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />

            <input
              type="text"
              placeholder="Buscar venda por item, cliente, valor ou pagamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <SectionHeader
          title="Operações encontradas"
          description={`Resultado das vendas conforme os filtros aplicados. ${finalFilteredSales.length} operação(ões) encontrada(s).`}
        />

        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 text-center border border-slate-800 rounded-xl text-slate-600 font-bold animate-pulse uppercase text-[10px] tracking-widest">
              Sincronizando fluxo de caixa...
            </div>
          ) : finalFilteredSales.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-16 text-center text-slate-500 font-bold text-sm">
              Nenhuma operação encontrada para os filtros aplicados.
            </div>
          ) : (
            finalFilteredSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-700/50 transition-all"
              >
                <div className="flex flex-col xl:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <h3 className="text-base font-bold tracking-tight text-white">
                            {sale.items.map((item, idx) => (
                              <span key={idx}>
                                <span className="text-emerald-500 font-bold mr-1">
                                  {item.saleQty}x
                                </span>
                                {item.name}
                                {idx < sale.items.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </h3>

                          {sale.maintenanceId && (
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1">
                              <Wrench size={10} />
                              MANUTENÇÃO
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <Clock size={10} />
                            {sale.time}
                          </div>

                          <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {sale.date}
                          </div>

                          {sale.clientName && (
                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                              <User size={10} className="text-slate-500" />
                              {sale.clientName}
                            </div>
                          )}

                          {sale.clientPhone && (
                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                              <Phone size={10} className="text-slate-500" />
                              {sale.clientPhone}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-left md:text-right flex flex-col md:items-end justify-between">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">
                            Valor Total
                          </p>

                          <p className="text-xl font-bold tracking-tight text-white">
                            {formatCurrency(sale.total)}
                          </p>
                        </div>

                        <div className="mt-2">
                          {sale.distributedPayments &&
                          sale.distributedPayments.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-start md:justify-end">
                              {sale.distributedPayments.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-900/40 text-purple-300 uppercase"
                                >
                                  {p.method}: {formatCurrency(p.value)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`text-[9px] font-black px-2 py-1 rounded border uppercase inline-block ${getPaymentColor(
                                sale.payment
                              )}`}
                            >
                              {sale.payment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:w-32 flex xl:flex-col gap-2 justify-center shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800/60 pt-4 xl:pt-0 xl:pl-4">
                    {sale.payment !== "Fiado" && sale.status === "completed" && (
                      <button
                        onClick={() => handleRefundRequest(sale.id)}
                        className="flex-1 xl:w-full bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 rounded-lg py-2 font-bold text-slate-500 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.97]"
                      >
                        <Undo2 size={13} />
                        Estornar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wider">
            Resumo do Período ({periodLabel})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryItem
              label="Vendas Concluídas"
              value={String(salesByPeriod.length)}
            />

            <SummaryItem
              label="Valor Total"
              value={formatCurrency(
                salesByPeriod.reduce((sum, s) => sum + s.total, 0)
              )}
              highlight="emerald"
            />

            <SummaryItem
              label="Ticket Médio"
              value={formatCurrency(
                salesByPeriod.length > 0
                  ? salesByPeriod.reduce((sum, s) => sum + s.total, 0) /
                      salesByPeriod.length
                  : 0
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="pt-2">
      <h2 className="text-sm font-black text-white uppercase tracking-wider">
        {title}
      </h2>

      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "emerald";
}) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-[10px] uppercase font-black tracking-wider">
        {label}
      </p>

      <p
        className={`text-xl font-black mt-1 ${
          highlight === "emerald" ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}