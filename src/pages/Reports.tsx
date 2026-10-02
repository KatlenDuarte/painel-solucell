// src/screens/Reports.tsx

import React, { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Calendar,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Download,
  Clock,
  Search,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Smartphone,
  Banknote,
  ReceiptText,
  Filter,
  Store,
} from "lucide-react";

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

const EXCLUDED_STORE_EMAIL = "minha-loja@exemplo.com";
const EXCLUDED_STORE_NORMALIZED = EXCLUDED_STORE_EMAIL.toLowerCase().trim();

const STORES = [
  { id: "all", label: "Todas as lojas" },
  { id: "vilaesportiva@solucell.com", label: "Vila Esportiva" },
  { id: "jardimdagloria@solucell.com", label: "Jardim da Glória" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export default function Reports() {
  const [sales, setSales] = useState<SaleData[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [period, setPeriod] = useState<
    "day" | "week" | "month" | "year" | "custom_month" | "custom"
  >("day");

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSales() {
      setLoading(true);

      try {
        const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          total: Number(docSnap.data().total) || 0,
          store: (docSnap.data().store || "").trim(),
        })) as SaleData[];

        setSales(data);
      } catch (error) {
        console.error("Erro ao buscar vendas:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSales();
  }, []);

  const isSaleValid = (sale: SaleData) => {
    const status = sale.status?.toLowerCase();
    const isCompleted = !status || status === "completed" || status === "active";
    const isNotExcluded =
      sale.store.toLowerCase().trim() !== EXCLUDED_STORE_NORMALIZED;

    return isCompleted && isNotExcluded;
  };

  const getSplitPayments = (sale: SaleData): FormattedPayment[] => {
    const dbPayments = sale.payments || {};
    const splits: FormattedPayment[] = [];

    if (sale.paymentMethod === "Múltiplos" || !sale.paymentMethod) {
      if (Number(dbPayments.pix) > 0) {
        splits.push({ method: "PIX", value: Number(dbPayments.pix) });
      }

      if (Number(dbPayments.cartao) > 0) {
        splits.push({ method: "CARTÃO", value: Number(dbPayments.cartao) });
      }

      if (Number(dbPayments.dinheiro) > 0) {
        splits.push({ method: "DINHEIRO", value: Number(dbPayments.dinheiro) });
      }
    }

    return splits;
  };

  const getStoreLabel = (store: string) => {
    return STORES.find((s) => s.id === store)?.label || store || "Loja não informada";
  };

  const getPaymentLabel = (sale: SaleData) => {
    const splits = getSplitPayments(sale);
    if (splits.length > 0) return "MÚLTIPLOS";
    return (sale.paymentMethod || "N/I").toUpperCase();
  };

  const getPaymentBadge = (method?: string) => {
    const m = (method || "").toUpperCase();

    if (m.includes("PIX")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (m.includes("CARTÃO") || m.includes("CARTAO")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (m.includes("DINHEIRO")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (m.includes("FIADO")) return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    if (m.includes("MÚLTIPLOS") || m.includes("MULTIPLOS")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";

    return "bg-slate-800 text-slate-400 border-slate-700";
  };

  const getPaymentIcon = (method?: string) => {
    const m = (method || "").toUpperCase();

    if (m.includes("PIX")) return Smartphone;
    if (m.includes("CARTÃO") || m.includes("CARTAO")) return CreditCard;
    if (m.includes("DINHEIRO")) return Banknote;
    if (m.includes("MÚLTIPLOS") || m.includes("MULTIPLOS")) return ReceiptText;

    return DollarSign;
  };

  const processedSales = useMemo(() => {
    const now = new Date();
    let startDateFilter: Date;
    let endDateFilter: Date | null = null;

    switch (period) {
      case "day":
        startDateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case "week":
        startDateFilter = new Date();
        startDateFilter.setDate(now.getDate() - 7);
        break;

      case "month":
        startDateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;

      case "year":
        startDateFilter = new Date(now.getFullYear(), 0, 1);
        break;

      case "custom_month":
        startDateFilter = new Date(selectedYear, selectedMonth, 1);
        endDateFilter = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
        break;

      case "custom":
        startDateFilter = startDate ? new Date(startDate + "T00:00:00") : new Date(0);
        endDateFilter = endDate ? new Date(endDate + "T23:59:59") : null;
        break;

      default:
        startDateFilter = new Date(0);
    }

    const filtered = sales.filter((sale) => {
      const saleDate = sale.timestamp?.toDate?.();
      if (!saleDate) return false;

      const matchesDate = endDateFilter
        ? saleDate >= startDateFilter && saleDate <= endDateFilter
        : saleDate >= startDateFilter;

      if (!matchesDate) return false;
      if (!isSaleValid(sale)) return false;

      const matchesStore =
        storeFilter === "all" ||
        sale.store.toLowerCase().trim() === storeFilter.toLowerCase().trim();

      if (!matchesStore) return false;

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
          const hasMethod = splits.some((p) =>
            p.method.toUpperCase().includes(paymentFilter.toUpperCase())
          );

          if (!hasMethod) return false;
        } else {
          const matchesPayment = (sale.paymentMethod || "")
            .toUpperCase()
            .includes(paymentFilter.toUpperCase());

          if (!matchesPayment) return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortDirection === "asc") return a.total - b.total;
      return b.total - a.total;
    });
  }, [
    sales,
    period,
    searchTerm,
    paymentFilter,
    storeFilter,
    sortDirection,
    selectedMonth,
    selectedYear,
    startDate,
    endDate,
  ]);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalPix = 0;
    let totalCartao = 0;
    let totalDinheiro = 0;

    processedSales.forEach((sale) => {
      totalRevenue += sale.total;

      const splits = getSplitPayments(sale);

      if (splits.length > 0) {
        splits.forEach((p) => {
          if (p.method.includes("PIX")) totalPix += p.value;
          if (p.method.includes("CARTÃO")) totalCartao += p.value;
          if (p.method.includes("DINHEIRO")) totalDinheiro += p.value;
        });
      } else {
        const method = (sale.paymentMethod || "").toUpperCase();

        if (method.includes("PIX")) totalPix += sale.total;
        if (method.includes("CARTA")) totalCartao += sale.total;
        if (method.includes("DINHEIRO")) totalDinheiro += sale.total;
      }
    });

    const totalSales = processedSales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return { totalRevenue, totalPix, totalCartao, totalDinheiro, totalSales, avgTicket };
  }, [processedSales]);

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const exportToPDF = async () => {
    const btn = document.querySelector(".no-export") as HTMLElement;

    if (btn) btn.style.display = "none";
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    pdf.setFontSize(18);
    pdf.text("SOLUCELL.", 14, 20);
    pdf.setFontSize(11);
    pdf.text(`Relatório de Vendas - Período: ${period}`, 14, 28);

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 5, 35, pdfWidth - 10, pdfHeight);
    pdf.save(`relatorio_${new Date().getTime()}.pdf`);

    if (btn) btn.style.display = "flex";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">
        Carregando relatório de movimentações...
      </div>
    );
  }

  return (
    <div
      ref={reportRef}
      className="min-h-screen bg-[#020617] text-slate-300 p-3 sm:p-4 md:p-8 font-sans antialiased space-y-5 md:space-y-6"
    >
      <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 md:gap-6 border-b border-slate-800 pb-5 md:pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-3">
            <BarChart3 size={13} />
            Relatórios
          </div>

          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Relatório de Vendas
          </h1>

          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Auditoria de transações, filtros por loja, data e formas de pagamento.
          </p>
        </div>

        <button
          onClick={exportToPDF}
          className="no-export w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-3 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Download size={15} />
          Exportar PDF
        </button>
      </header>

      <section className="no-export bg-slate-900/40 border border-slate-800 p-4 md:p-5 rounded-2xl space-y-5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">
            Filtros do Relatório
          </h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Período rápido
            </p>

            <div className="flex flex-wrap gap-1.5 bg-slate-950/70 border border-slate-800 rounded-xl p-1">
              {[
                { label: "Hoje", value: "day" },
                { label: "7 Dias", value: "week" },
                { label: "Mês", value: "month" },
                { label: "Ano", value: "year" },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value as any)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[11px] font-black transition-all ${
                    period === value
                      ? "bg-white text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Loja
            </p>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-blue-500"
            >
              {STORES.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Histórico por mês
            </p>

            <div className="grid grid-cols-[1fr_90px] gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(Number(e.target.value));
                  setPeriod("custom_month");
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2026, i)
                      .toLocaleString("pt-BR", { month: "long" })
                      .toUpperCase()}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setPeriod("custom_month");
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-white outline-none text-center focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Data inicial e final
            </p>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriod("custom");
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-blue-500"
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriod("custom");
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <MetricCard
          title="Faturamento"
          value={formatCurrency(metrics.totalRevenue)}
          icon={<DollarSign size={22} />}
          description="Receita no período"
          color="emerald"
        />

        <MetricCard
          title="Vendas"
          value={`${metrics.totalSales}`}
          icon={<ShoppingCart size={22} />}
          description="Quantidade de transações"
          color="blue"
        />

        <MetricCard
          title="Ticket Médio"
          value={formatCurrency(metrics.avgTicket)}
          icon={<CreditCard size={22} />}
          description="Média por venda"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PaymentCard label="PIX" value={metrics.totalPix} color="emerald" />
        <PaymentCard label="Cartão" value={metrics.totalCartao} color="blue" />
        <PaymentCard label="Dinheiro" value={metrics.totalDinheiro} color="amber" />
      </div>

      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="no-export px-4 md:px-5 py-4 border-b border-slate-800 grid grid-cols-1 md:grid-cols-[1fr_180px_170px] gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              size={16}
            />

            <input
              placeholder="Buscar por produto ou ID da venda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500"
          >
            <option value="all">TODOS PAGAMENTOS</option>
            <option value="pix">PIX</option>
            <option value="cartão">CARTÃO</option>
            <option value="dinheiro">DINHEIRO</option>
            <option value="fiado">FIADO</option>
          </select>

          <button
            onClick={toggleSort}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl text-xs font-black text-slate-400 flex items-center justify-center gap-2 transition-all"
          >
            Ordenar valor
            {sortDirection === "desc" ? (
              <ArrowDown size={13} className="text-blue-500" />
            ) : (
              <ArrowUp size={13} className="text-emerald-500" />
            )}
          </button>
        </div>

        {processedSales.length === 0 ? (
          <div className="text-center py-16 text-slate-600 text-xs font-black uppercase tracking-widest px-4">
            Nenhuma movimentação encontrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {processedSales.map((sale) => {
              const splits = getSplitPayments(sale);
              const paymentLabel = getPaymentLabel(sale);
              const PaymentIcon = getPaymentIcon(paymentLabel);

              return (
                <div
                  key={sale.id}
                  className="p-4 md:p-5 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black border ${getPaymentBadge(
                            paymentLabel
                          )}`}
                        >
                          <PaymentIcon size={12} />
                          {paymentLabel}
                        </span>

                        <span className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 text-slate-500 rounded-lg px-2 py-1 text-[10px] font-black uppercase">
                          <Store size={11} />
                          {getStoreLabel(sale.store)}
                        </span>
                      </div>

                      <p className="text-sm text-white font-bold line-clamp-2 md:truncate">
                        {sale.items?.length
                          ? sale.items
                              .map(
                                (i: any) =>
                                  `${i.saleQty || i.qty || 1}x ${
                                    i.name || "Produto"
                                  }`
                              )
                              .join(", ")
                          : "Venda Direta / Serviço"}
                      </p>

                      <p className="text-[10px] text-slate-600 font-mono mt-1 break-all select-all">
                        {sale.id}
                      </p>

                      {splits.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {splits.map((p, idx) => (
                            <span
                              key={idx}
                              className="bg-purple-500/10 border border-purple-500/20 text-[9px] font-black px-1.5 py-0.5 rounded text-purple-300"
                            >
                              {p.method}: {formatCurrency(p.value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 xl:text-right">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black">
                          Total
                        </p>

                        <p className="text-lg md:text-xl font-black text-emerald-400">
                          {formatCurrency(sale.total)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-black">
                          Data/Hora
                        </p>

                        <p className="text-xs text-slate-300 font-bold flex items-center gap-1 xl:justify-end">
                          <Calendar size={12} />
                          {sale.timestamp?.toDate?.().toLocaleDateString("pt-BR")}
                        </p>

                        <p className="text-[10px] text-slate-500 flex items-center gap-1 xl:justify-end mt-1">
                          <Clock size={11} />
                          {sale.timestamp?.toDate?.().toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "emerald" | "blue" | "purple";
}) {
  const colorClass =
    color === "emerald"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : color === "blue"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-purple-500/10 text-purple-400 border-purple-500/20";

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-4 md:p-5 rounded-2xl relative overflow-hidden">
      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>

      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-4">
        {title}
      </p>

      <p className="text-xl md:text-2xl font-black text-white mt-1">
        {value}
      </p>

      <p className="text-xs text-slate-600 mt-2">
        {description}
      </p>
    </div>
  );
}

function PaymentCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "blue" | "amber";
}) {
  const colorClass =
    color === "emerald"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : color === "blue"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  return (
    <div className={`border rounded-xl p-4 ${colorClass}`}>
      <p className="text-[10px] font-black uppercase tracking-widest">
        {label}
      </p>

      <p className="text-base md:text-lg font-black mt-1">
        {formatCurrency(value)}
      </p>
    </div>
  );
}