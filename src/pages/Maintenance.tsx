// src/screens/Maintenance.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  Phone,
  Edit2,
  Trash2,
  Zap,
  DollarSign,
  Loader,
  Filter,
  Smartphone,
  User,
  Calendar,
  BadgeDollarSign,
} from "lucide-react";

import {
  fetchMaintenances,
  deleteMaintenance as deleteMaintenanceService,
  updateMaintenance as updateMaintenanceService,
} from "../services/maintenanceService";

import AddMaintenanceModal from "../components/AddMaintenanceModal";
import EditMaintenanceModal from "../components/EditMaintenanceModal";

interface Maintenance {
  id: string;
  customer: string;
  phone: string;
  device: string;
  brand: string;
  model: string;
  issue: string;
  status:
    | "pending"
    | "parts_ordered"
    | "in_progress"
    | "completed"
    | "cancelled";
  value: number;
  paid: boolean;
  partOrdered: boolean;
  orderDate?: string;
  deliveryDate: string;
  createdAt: string;
  notes?: string;
}

const useAuth = () => ({
  storeEmail: "minha-loja@exemplo.com",
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const MaintenancePage = () => {
  const { storeEmail } = useAuth();

  const [loading, setLoading] = useState(true);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">(
    "all"
  );
  const [selectedDate, setSelectedDate] = useState("");

  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] =
    useState<Maintenance | null>(null);

  const [quickActionLoadingId, setQuickActionLoadingId] = useState<
    string | null
  >(null);

  const loadMaintenances = useCallback(async () => {
    if (!storeEmail) {
      console.error("E-mail da loja não disponível para carregar manutenções.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await fetchMaintenances(storeEmail);
      setMaintenances(data as Maintenance[]);
    } catch (error) {
      console.error("Erro ao carregar manutenções:", error);
    } finally {
      setLoading(false);
    }
  }, [storeEmail]);

  useEffect(() => {
    loadMaintenances();
  }, [loadMaintenances]);

  useEffect(() => {
    const isModalOpen = showAddModal || showEditModal;
    document.body.classList.toggle("no-scroll", isModalOpen);

    return () => document.body.classList.remove("no-scroll");
  }, [showAddModal, showEditModal]);

  const statusConfig: {
    [key in Maintenance["status"]]: {
      label: string;
      color: string;
      icon: any;
    };
  } = {
    pending: {
      label: "Aguardando",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: Clock,
    },
    parts_ordered: {
      label: "Peça Pedida",
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      icon: Package,
    },
    in_progress: {
      label: "Em Reparo",
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      icon: Wrench,
    },
    completed: {
      label: "Concluído",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle,
    },
    cancelled: {
      label: "Cancelado",
      color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      icon: XCircle,
    },
  };

  const matchesPeriod = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();

    if (selectedDate) {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0);
      const end = new Date(y, m - 1, d, 23, 59, 59);
      return created >= start && created <= end;
    }

    if (period === "all") return true;

    if (period === "today") {
      return (
        created.getDate() === now.getDate() &&
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }

    if (period === "week") {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      return created >= start;
    }

    if (period === "month") {
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }

    return true;
  };

  const filteredMaintenances = useMemo(() => {
    return maintenances
      .filter((m) => {
        const term = searchTerm.toLowerCase();

        const matchesSearch =
          m.customer?.toLowerCase().includes(term) ||
          m.phone?.toLowerCase().includes(term) ||
          m.device?.toLowerCase().includes(term) ||
          m.brand?.toLowerCase().includes(term) ||
          m.model?.toLowerCase().includes(term) ||
          m.issue?.toLowerCase().includes(term);

        if (!matchesSearch) return false;

        const matchesStatus = statusFilter === "all" || m.status === statusFilter;
        if (!matchesStatus) return false;

        if (paymentFilter === "paid" && !m.paid) return false;
        if (paymentFilter === "pending" && m.paid) return false;

        if (!matchesPeriod(m.createdAt)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortDirection === "asc") return a.value - b.value;
        return b.value - a.value;
      });
  }, [
    maintenances,
    searchTerm,
    statusFilter,
    paymentFilter,
    period,
    selectedDate,
    sortDirection,
  ]);

  const metrics = useMemo(() => {
    const totalRevenue = filteredMaintenances.reduce(
      (acc, item) => acc + Number(item.value || 0),
      0
    );

    const completed = filteredMaintenances.filter(
      (m) => m.status === "completed"
    ).length;

    const inProgress = filteredMaintenances.filter(
      (m) => m.status === "in_progress"
    ).length;

    const pending = filteredMaintenances.filter(
      (m) => m.status === "pending"
    ).length;

    const partsOrdered = filteredMaintenances.filter(
      (m) => m.status === "parts_ordered"
    ).length;

    const paid = filteredMaintenances.filter((m) => m.paid).length;
    const unpaid = filteredMaintenances.filter((m) => !m.paid).length;

    return {
      totalRevenue,
      total: filteredMaintenances.length,
      completed,
      inProgress,
      pending,
      partsOrdered,
      paid,
      unpaid,
    };
  }, [filteredMaintenances]);

  const openEditModal = (m: Maintenance) => {
    setSelectedMaintenance(m);
    setShowEditModal(true);
  };

  const handleDataUpdate = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedMaintenance(null);
    loadMaintenances();
  };

  const handleDelete = async (id: string) => {
    if (
      confirm("Tem certeza que deseja excluir esta manutenção? Esta ação é irreversível.")
    ) {
      try {
        await deleteMaintenanceService(id);
        loadMaintenances();
      } catch (error) {
        console.error("Erro ao deletar manutenção:", error);
        alert("Erro ao tentar deletar a manutenção.");
      }
    }
  };

  const togglePaidStatus = async (maintenance: Maintenance) => {
    setQuickActionLoadingId(maintenance.id);

    const newPaidStatus = !maintenance.paid;

    try {
      await updateMaintenanceService(maintenance.id, {
        paid: newPaidStatus,
      });

      setMaintenances((prev) =>
        prev.map((m) =>
          m.id === maintenance.id ? { ...m, paid: newPaidStatus } : m
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status de pagamento:", error);
      alert("Erro ao atualizar o status de pagamento.");
    } finally {
      setQuickActionLoadingId(null);
    }
  };

  const advanceStatus = async (maintenance: Maintenance) => {
    const statusOrder: Maintenance["status"][] = [
      "pending",
      "parts_ordered",
      "in_progress",
      "completed",
    ];

    if (maintenance.status === "cancelled" || maintenance.status === "completed") {
      alert("Não é possível avançar uma manutenção Cancelada ou Concluída.");
      return;
    }

    const currentIndex = statusOrder.indexOf(maintenance.status);
    const nextStatus = statusOrder[currentIndex + 1];

    if (!nextStatus) return;

    setQuickActionLoadingId(maintenance.id);

    try {
      await updateMaintenanceService(maintenance.id, {
        status: nextStatus,
      });

      setMaintenances((prev) =>
        prev.map((m) =>
          m.id === maintenance.id ? { ...m, status: nextStatus } : m
        )
      );
    } catch (error) {
      console.error("Erro ao avançar o status:", error);
      alert("Erro ao avançar o status da manutenção.");
    } finally {
      setQuickActionLoadingId(null);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">
        Carregando manutenções...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-3 sm:p-4 md:p-8 space-y-5 md:space-y-6 font-sans antialiased">
      <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-5 border-b border-slate-800 pb-5 md:pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-3">
            <Wrench size={13} />
            Operacional
          </div>

          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Central de Manutenções
          </h1>

          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Controle serviços, reparos, pagamentos, peças e entregas com ações rápidas.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-black transition-all active:scale-[0.98]"
        >
          <Plus size={15} />
          Nova Manutenção
        </button>
      </header>

      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">
            Filtros
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, telefone, aparelho, marca ou problema..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-blue-500"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-blue-500"
          >
            <option value="all">Todos pagamentos</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
 {[
  { label: "Hoje", value: "today" },
  { label: "7 Dias", value: "week" },
  { label: "Mês", value: "month" },
].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setPeriod(item.value as any);
                clearDateFilter();
              }}
              className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all ${
                period === item.value && !selectedDate
                  ? "bg-white text-slate-950"
                  : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() =>
              setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
            }
            className="px-3 py-2 rounded-lg text-[11px] font-black bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-all"
          >
            Valor {sortDirection === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <MetricCard title="Faturamento" value={formatCurrency(metrics.totalRevenue)} icon={<BadgeDollarSign size={18} />} color="emerald" />
        <MetricCard title="Total" value={metrics.total} icon={<Smartphone size={18} />} color="blue" />
        <MetricCard title="Aguardando" value={metrics.pending} icon={<Clock size={18} />} color="amber" />
        <MetricCard title="Peças" value={metrics.partsOrdered} icon={<Package size={18} />} color="blue" />
        <MetricCard title="Em Reparo" value={metrics.inProgress} icon={<Wrench size={18} />} color="purple" />
        <MetricCard title="Concluídos" value={metrics.completed} icon={<CheckCircle size={18} />} color="emerald" />
        <MetricCard title="Pagos" value={metrics.paid} icon={<DollarSign size={18} />} color="blue" />
        <MetricCard title="Pendentes" value={metrics.unpaid} icon={<AlertCircle size={18} />} color="rose" />
      </section>

      {filteredMaintenances.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-bold text-sm">
            Nenhuma manutenção encontrada.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Ajuste os filtros ou cadastre uma nova manutenção.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          {filteredMaintenances.map((m) => {
            const StatusIcon = statusConfig[m.status].icon;
            const isLoading = quickActionLoadingId === m.id;

            return (
              <div
                key={m.id}
                className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:p-5 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col xl:flex-row gap-5 xl:items-center justify-between">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5 text-blue-400" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm md:text-base font-bold text-white truncate">
                            {m.device}
                          </h3>

                          <p className="text-xs text-slate-500 mt-0.5">
                            {m.brand} • {m.model}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-black text-slate-500 inline-flex items-center gap-1">
                              <User size={11} />
                              {m.customer}
                            </span>

                            <span className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-black text-slate-500 inline-flex items-center gap-1">
                              <Phone size={11} />
                              {m.phone || "Sem telefone"}
                            </span>

                            <span className={`border rounded-lg px-2 py-1 text-[10px] font-black inline-flex items-center gap-1 ${statusConfig[m.status].color}`}>
                              <StatusIcon size={11} />
                              {statusConfig[m.status].label}
                            </span>

                            <button
                              onClick={() => togglePaidStatus(m)}
                              disabled={isLoading}
                              className={`border rounded-lg px-2 py-1 text-[10px] font-black inline-flex items-center gap-1 transition-all ${
                                m.paid
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              } disabled:opacity-50`}
                            >
                              {isLoading ? (
                                <Loader size={11} className="animate-spin" />
                              ) : m.paid ? (
                                "PAGO"
                              ) : (
                                "PENDENTE"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-[10px] text-slate-500 uppercase font-black">
                          Valor
                        </p>
                        <p className="text-xl md:text-2xl font-black text-emerald-400">
                          {formatCurrency(m.value)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500 uppercase font-black mb-1">
                        Problema relatado
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.issue}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <InfoBox
                        label="Criado"
                        value={new Date(m.createdAt).toLocaleDateString("pt-BR")}
                        icon={<Calendar size={12} />}
                      />

                      <InfoBox
                        label="Entrega"
                        value={
                          m.deliveryDate
                            ? new Date(m.deliveryDate).toLocaleDateString("pt-BR")
                            : "-"
                        }
                        icon={<Clock size={12} />}
                      />

                      <InfoBox
                        label="Peça"
                        value={m.partOrdered ? "Solicitada" : "Não solicitada"}
                        icon={<Package size={12} />}
                      />

                      <InfoBox
                        label="Código"
                        value={m.id.slice(0, 8)}
                        icon={<Wrench size={12} />}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 xl:grid-cols-1 gap-2 xl:w-40 shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800 pt-4 xl:pt-0 xl:pl-4">
                    {!["completed", "cancelled"].includes(m.status) && (
                      <button
                        title="Avançar Status"
                        onClick={() => advanceStatus(m)}
                        disabled={isLoading}
                        className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl py-2.5 flex items-center justify-center gap-1 text-blue-400 text-xs font-black disabled:opacity-50"
                      >
                        <Zap size={14} />
                        <span className="hidden sm:inline">Avançar</span>
                      </button>
                    )}

                    <button
                      title="Editar Manutenção"
                      onClick={() => openEditModal(m)}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-1 text-slate-300 text-xs font-black"
                    >
                      <Edit2 size={14} />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    <button
                      title="Excluir Manutenção"
                      onClick={() => handleDelete(m.id)}
                      className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl py-2.5 flex items-center justify-center gap-1 text-rose-400 text-xs font-black"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {showAddModal && (
        <AddMaintenanceModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleDataUpdate}
          storeEmail={storeEmail}
        />
      )}

      {showEditModal && selectedMaintenance && (
        <EditMaintenanceModal
          maintenance={selectedMaintenance}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMaintenance(null);
          }}
          onUpdate={handleDataUpdate}
        />
      )}
    </div>
  );
};

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "amber" | "purple" | "rose";
}) {
  const colorClass =
    color === "emerald"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : color === "blue"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : color === "amber"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : color === "purple"
      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
      : "bg-rose-500/10 text-rose-400 border-rose-500/20";

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
      <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>

      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-3">
        {title}
      </p>

      <p className="text-lg font-black text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
      <p className="text-[9px] text-slate-500 uppercase font-black flex items-center gap-1">
        {icon}
        {label}
      </p>

      <p className="text-xs text-white font-bold mt-1 truncate">
        {value}
      </p>
    </div>
  );
}

export default MaintenancePage;