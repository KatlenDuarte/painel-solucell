import React, { useState, useEffect } from "react";
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
} from "lucide-react";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
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

interface Sale {
  id: string;
  date: string;
  time: string;
  items: SaleItem[];
  total: number;
  payment: string;
  status: "completed" | "pending" | "refunded";
}

interface SaleWithClient extends Sale {
  clientName?: string;
  clientPhone?: string;
}

interface SalesProps {
  storeEmail: string;
}

// Funções utilitárias para comparação de data (fora do componente)
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
  const dayOfWeek = now.getDay(); // 0 (dom) a 6 (sáb)
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

export default function Sales({ storeEmail }: SalesProps) {
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">("today");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
  const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
  const [viewMode, setViewMode] = useState<"sales" | "fiado">("sales");

  const [sales, setSales] = useState<SaleWithClient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Busca vendas no Firestore, ordenadas por timestamp desc, excluindo reembolsadas
  const fetchSalesFromFirestore = async () => {
    try {
      const q = query(
        collection(db, "sales"),
        where("store", "==", storeEmail),
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
            payment: data.paymentMethod || "PIX",
            status,
            clientName: data.clientName,
            clientPhone: data.clientPhone,
          };
        })
        // Exclui vendas reembolsadas da lista principal
        .filter((sale) => sale.status !== "refunded");

      setSales(list);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
    }
  };

  useEffect(() => {
    fetchSalesFromFirestore();
  }, []);

  // Filtra vendas por período selecionado
  const filterSalesByPeriod = (salesList: SaleWithClient[]) => {
    return salesList.filter((sale) => {
      const date = (sale as any).dateObject as Date | undefined;
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

  // Vendas fiado pendentes (status 'pending' e payment 'Fiado')
  const fiadoPendingSales = sales.filter(
    (sale) => sale.payment.toLowerCase() === "fiado" && sale.status === "pending"
  );

  // Contagem e total fiado pendentes
  const fiadoPendingCount = fiadoPendingSales.length;
  const fiadoPendingTotal = fiadoPendingSales.reduce((sum, s) => sum + s.total, 0);

  // 1. Filtra vendas pelo período
  const salesByPeriod = filterSalesByPeriod(sales);

  // 2. Filtra vendas pelo termo de busca (busca em nome dos itens, total, cliente e método pagamento)
  const finalFilteredSales = salesByPeriod.filter((sale) => {
    const search = searchTerm.toLowerCase();

    const matchesItemName = sale.items.some((item) =>
      item.name.toLowerCase().includes(search)
    );

    const matchesTotal = sale.total.toFixed(2).includes(search);

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

  // Calcula estatísticas por método de pagamento para os cards
  const paymentStatsMap: Record<string, { count: number; total: number }> = {
    PIX: { count: 0, total: 0 },
    Cartão: { count: 0, total: 0 },
    Dinheiro: { count: 0, total: 0 },
    Fiado: { count: 0, total: 0 },
  };

  salesByPeriod.forEach((sale) => {
    const method = sale.payment;
    const total = sale.total;
    const status = sale.status;

    // Conta vendas completas e pendentes Fiado no período
    if (status === "completed" || (method.toLowerCase() === "fiado" && status === "pending")) {
      if (paymentStatsMap[method]) {
        paymentStatsMap[method].count += 1;
        paymentStatsMap[method].total += total;
      }
    }
  });

  // Corrige Fiado nos cards pra mostrar só pendentes, usando lista completa
  paymentStatsMap["Fiado"].count = fiadoPendingCount;
  paymentStatsMap["Fiado"].total = fiadoPendingTotal;

  const paymentStats = [
    {
      method: "PIX",
      icon: Smartphone,
      count: paymentStatsMap["PIX"].count,
      total: paymentStatsMap["PIX"].total,
      color: "emerald",
    },
    {
      method: "Cartão",
      icon: CreditCard,
      count: paymentStatsMap["Cartão"].count,
      total: paymentStatsMap["Cartão"].total,
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
    switch (method) {
      case "PIX":
      case "Cartão":
      case "Dinheiro":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
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
  };

  const handleRegisterPayment = (saleId: string, paymentMethod: string) => {
    // Atualiza venda localmente após pagamento do Fiado
    setSales((prevSales) =>
      prevSales.map((sale) =>
        sale.id === saleId
          ? { ...sale, status: "completed", payment: paymentMethod }
          : sale
      )
    );
  };

  const handleRefundSuccess = (refundedSaleId: string) => {
    setSales((prevSales) => prevSales.filter((sale) => sale.id !== refundedSaleId));
  };

  if (viewMode === "fiado") {
    return (
      <FiadoScreen
        onGoBack={() => setViewMode("sales")}
        fiadoSales={fiadoPendingSales}
        onRegisterPayment={handleRegisterPayment}
      />
    );
  }

  return (
    <div className="p-8 space-y-6 bg-slate-950 min-h-screen">
      <RefundConfirmationModal
        saleId={refundSaleId}
        onClose={handleCloseModal}
        onRefundSuccess={handleRefundSuccess}
      />

      {isNewSaleModalOpen && (
        <NewSaleModal
          onClose={handleCloseNewSaleModal}
          storeEmail={storeEmail}
          isOpen={true}
          onSaleComplete={async () => {
            await fetchSalesFromFirestore();
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Vendas 🚀</h1>
          <p className="text-slate-400 text-sm">Gerencie e registre todas as vendas</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode("fiado")}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all font-medium border border-red-500/30"
            title="Ver Contas a Receber"
          >
            <BookOpenText className="w-5 h-5" />
            Fiado ({fiadoPendingCount})
          </button>

          <button
            onClick={handleOpenNewSaleModal}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Nova Venda
          </button>
        </div>
      </div>

      <hr className="my-6 border-slate-800" />

      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {paymentStats.map((stat) => {
          const Icon = stat.icon;
          const iconBgClass = `bg-${stat.color}-500/10`;
          const iconColorClass = `text-${stat.color}-500`;

          return (
            <div
              key={stat.method}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 ${iconBgClass} rounded-md flex items-center justify-center`}
                  >
                    <Icon className={`w-4 h-4 ${iconColorClass}`} />
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

      <hr className="my-6 border-slate-800" />

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {["all", "today", "week", "month"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filter === f
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

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar venda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all text-sm"
          />
        </div>
      </div>

      <hr className="my-6 border-slate-800" />

      {/* Sales List */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white">Últimas Transações ({finalFilteredSales.length} resultados)</h2>

        {finalFilteredSales.length === 0 && (
          <p className="text-slate-500 text-center py-10">Nenhuma venda encontrada para o período e busca selecionados.</p>
        )}

        {finalFilteredSales.map((sale) => (
          <div
            key={sale.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all relative"
          >
            {/* TODA A PARTE VISUAL — MANTIDA */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center 
                                        ${sale.payment === 'Fiado' && sale.status === 'pending'
                      ? 'bg-red-500/10'
                      : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}
                >
                  {sale.payment === 'Fiado' && sale.status === 'pending'
                    ? <BookOpenText className="w-5 h-5 text-red-400" />
                    : <DollarSign className="w-5 h-5 text-white" />
                  }
                </div>

                <div>
                  <div className="flex flex-col text-sm">
                    <span className="flex items-center gap-2 text-white font-medium">
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

              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  {/* O botão de reembolso aparece apenas se a venda for 'completed' e não for 'Fiado' */}
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
                    R$ {sale.total.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2 justify-end mt-1">
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

            {/* Informações do Cliente Fiado */}
            {sale.payment === "Fiado" && sale.clientName && (
              <div className="bg-red-900/10 border-t border-red-700/50 pt-2 pb-1 px-4 my-3 mx-[-1rem] rounded-md flex items-center justify-between">
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

            {/* Itens da Venda */}
            <div className="border-t border-slate-800 pt-3">
              <div className="space-y-1">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">
                      {item.saleQty}x {item.name}
                    </span>
                    <span className="text-white font-medium">
                      R$ {item.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <hr className="my-6 border-slate-800" />

      {/* Resumo Final - (Valores calculados com base em 'salesByPeriod') */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-5 mt-6 shadow-xl">
        <h2 className="text-xl font-bold text-emerald-300 mb-4">Resumo do Período ({filter === "all" ? "Todas" : filter === "today" ? "Hoje" : filter === "week" ? "Esta Semana" : "Este Mês"})</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-slate-400 text-sm uppercase">Vendas Concluídas</p>
            <p className="text-xl font-extrabold text-white mt-1">{salesByPeriod.filter(s => s.status === 'completed' || s.status === 'pending').length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase">Valor Total (Recebido + Pendente)</p>
            <p className="text-xl font-extrabold text-white mt-1">R$ {salesByPeriod.reduce((sum, s) => sum + s.total, 0).toFixed(2).replace('.', ',')}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase">Ticket Médio</p>
            <p className="text-xl font-extrabold text-white mt-1">
              R$ {(salesByPeriod.length > 0 ? (salesByPeriod.reduce((sum, s) => sum + s.total, 0) / salesByPeriod.length) : 0).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}