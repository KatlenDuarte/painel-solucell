// src/screens/Maintenance.tsx

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Wrench,
    Search,
    Plus,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Package,
    DollarSign,
    Loader,
    ArrowUp,
    ArrowDown,
    Edit2,
    Trash2,
    Phone,
    CreditCard,
    Printer,
    ChevronsRight
} from "lucide-react";
import DateRangeFilter from "../components/DateRangeFilter";
import { rangeBounds, toInputDate, type DateRange } from "../lib/dateRange";
import { Page, PageHeader, Card, StatCard, Button, IconButton, Badge, Segmented, SearchInput, EmptyState, LoadingState, ListRow, type Tone } from "../components/ui";
import { formatBRL, initials } from "../lib/format";

import {
    subscribeMaintenances,
    deleteMaintenance as deleteMaintenanceService,
    updateMaintenance as updateMaintenanceService
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
    deliveryDate?: string;
    createdAt: string;
    notes?: string;
}

const useAuth = () => ({
    storeEmail: "minha-loja@exemplo.com"
});

export default function MaintenancePage() {
    const { storeEmail } = useAuth();

    const [loading, setLoading] = useState(true);
    const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

    // filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");

    // períodos
    const [period, setPeriod] = useState<
        "today" | "week" | "month" | "year" | "custom_range" | "custom_month"
    >("today");

    const [range, setRange] = useState<DateRange>(() => {
        const now = new Date();
        return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) };
    });
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().getMonth()
    );
    const [selectedYear, setSelectedYear] = useState(
        new Date().getFullYear()
    );

    // ordenação
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
        "desc"
    );

    // modais
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const [selectedMaintenance, setSelectedMaintenance] =
        useState<Maintenance | null>(null);

    const [quickActionLoadingId, setQuickActionLoadingId] = useState<
        string | null
    >(null);

    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedOS, setSelectedOS] = useState<Maintenance | null>(null);

    // Listener em tempo real: antes a coleção inteira era relida a cada
    // criação/edição/exclusão; agora só os documentos alterados chegam.
    useEffect(() => {
        if (!storeEmail) return;

        return subscribeMaintenances(
            storeEmail,
            (data) => {
                setMaintenances(data.map(m => ({
                    ...m,
                    customer: String(m.customer ?? ""),
                    phone: String(m.phone ?? ""),
                    device: String(m.device ?? ""),
                    brand: String(m.brand ?? ""),
                    model: String(m.model ?? ""),
                    issue: String(m.issue ?? ""),
                    status: m.status || "pending",
                    value: Number(m.value) || 0,
                })) as Maintenance[]);
                setLoading(false);
            },
            (error) => {
                console.error(error);
                setLoading(false);
            }
        );
    }, [storeEmail]);

    // Mantido para os callbacks: o listener já reflete as alterações.
    const loadMaintenances = useCallback(() => {}, []);

    const handlePrintOS = async (maintenance: Maintenance) => {
        try {
            const dadosImpressao = {
                isOS: true,
                customer: maintenance.customer,
                phone: maintenance.phone,
                total: maintenance.value,
                paymentMethod: maintenance.paid
                    ? "Recebido / Antecipado"
                    : "A Pagar na Retirada",
                items: [
                    {
                        saleQty: 1,
                        name: `Aparelho: ${maintenance.device} ${maintenance.model || ""}`.trim(),
                        price: maintenance.value
                    },
                    {
                        saleQty: 1,
                        name: `Defeito: ${maintenance.issue}`,
                        price: 0
                    }
                ]
            };

            const response = await fetch("http://localhost:3333/print", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dadosImpressao)
            });

            if (!response.ok) {
                throw new Error("Erro ao imprimir");
            }

        } catch (error) {
            console.error("Erro ao reimprimir O.S:", error);
            alert("Erro ao enviar para impressão.");
        }
    };
    const statusConfig: Record<Maintenance["status"], { label: string; tone: Tone; icon: typeof Clock }> = {
        pending: { label: "Aguardando", tone: "warning", icon: Clock },
        parts_ordered: { label: "Peça pedida", tone: "info", icon: Package },
        in_progress: { label: "Em reparo", tone: "primary", icon: Wrench },
        completed: { label: "Concluído", tone: "success", icon: CheckCircle },
        cancelled: { label: "Cancelado", tone: "neutral", icon: XCircle },
    };

    const nextStatusLabel: Partial<Record<Maintenance["status"], string>> = {
        pending: "Marcar peça pedida",
        parts_ordered: "Iniciar reparo",
        in_progress: "Concluir reparo",
    };

    const processedMaintenances = useMemo(() => {
        const now = new Date();

        let startDate: Date;
        let endDate: Date | null = null;

        switch (period) {
            case "today":
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );
                break;

            case "week":
                startDate = new Date();
                startDate.setDate(now.getDate() - 7);
                break;

            case "month":
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );
                break;

            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                break;

            case "custom_month":
                startDate = new Date(selectedYear, selectedMonth, 1);
                endDate = new Date(
                    selectedYear,
                    selectedMonth + 1,
                    0,
                    23,
                    59,
                    59
                );
                break;

            case "custom_range": {
                const bounds = rangeBounds(range);
                startDate = bounds.start ?? new Date(0);
                endDate = bounds.end;
                break;
            }

            default:
                startDate = new Date(0);
        }

        const filtered = maintenances.filter((m) => {
            const created = new Date(m.createdAt);

            const matchesDate = endDate
                ? created >= startDate && created <= endDate
                : created >= startDate;

            if (!matchesDate) return false;

            const term = searchTerm.toLowerCase();

            const matchesSearch =
                m.customer.toLowerCase().includes(term) ||
                m.device.toLowerCase().includes(term) ||
                m.issue.toLowerCase().includes(term) ||
                m.brand.toLowerCase().includes(term);

            if (!matchesSearch) return false;

            const matchesStatus =
                statusFilter === "all" ||
                m.status === statusFilter;

            if (!matchesStatus) return false;

            if (paymentFilter === "paid" && !m.paid)
                return false;

            if (paymentFilter === "pending" && m.paid)
                return false;

            return true;
        });

        return filtered.sort((a, b) => {
            if (sortDirection === "asc") {
                return a.value - b.value;
            }

            return b.value - a.value;
        });
    }, [
        maintenances,
        period,
        range,
        selectedMonth,
        selectedYear,
        searchTerm,
        statusFilter,
        paymentFilter,
        sortDirection
    ]);

    const metrics = useMemo(() => {
        const total = processedMaintenances.reduce(
            (acc, item) => acc + item.value,
            0
        );

        const completed = processedMaintenances.filter(
            (m) => m.status === "completed"
        ).length;

        const pending = processedMaintenances.filter(
            (m) =>
                m.status === "pending" ||
                m.status === "in_progress"
        ).length;

        const paid = processedMaintenances.filter(
            (m) => m.paid
        ).length;

        const unpaid = processedMaintenances.filter(
            (m) => !m.paid
        ).length;

        return {
            total,
            completed,
            pending,
            paid,
            unpaid
        };
    }, [processedMaintenances]);

    const toggleSort = () => {
        setSortDirection((prev) =>
            prev === "desc" ? "asc" : "desc"
        );
    };

    const openEditModal = (m: Maintenance) => {
        setSelectedMaintenance(m);
        setShowEditModal(true);
    };

    const handleDataUpdate = () => {
        setShowAddModal(false);
        setShowEditModal(false);
        loadMaintenances();
    };

    const handleDelete = async (id: string) => {
        const confirmDelete = confirm(
            "Deseja excluir esta manutenção?"
        );

        if (!confirmDelete) return;

        try {
            await deleteMaintenanceService(id);
            loadMaintenances();
        } catch (error) {
            console.error(error);
        }
    };

    const togglePaidStatus = async (
        maintenance: Maintenance
    ) => {
        setQuickActionLoadingId(maintenance.id);

        try {
            await updateMaintenanceService(maintenance.id, {
                paid: !maintenance.paid
            });

            setMaintenances((prev) =>
                prev.map((m) =>
                    m.id === maintenance.id
                        ? { ...m, paid: !m.paid }
                        : m
                )
            );
        } catch (error) {
            console.error(error);
        } finally {
            setQuickActionLoadingId(null);
        }
    };

    const advanceStatus = async (
        maintenance: Maintenance
    ) => {
        const flow: Maintenance["status"][] = [
            "pending",
            "parts_ordered",
            "in_progress",
            "completed"
        ];

        const currentIndex = flow.indexOf(
            maintenance.status
        );

        if (
            currentIndex === -1 ||
            maintenance.status === "completed" ||
            maintenance.status === "cancelled"
        ) {
            return;
        }

        const nextStatus = flow[currentIndex + 1];

        if (!nextStatus) return;

        setQuickActionLoadingId(maintenance.id);

        try {
            await updateMaintenanceService(maintenance.id, {
                status: nextStatus
            });

            setMaintenances((prev) =>
                prev.map((m) =>
                    m.id === maintenance.id
                        ? { ...m, status: nextStatus }
                        : m
                )
            );
        } catch (error) {
            console.error(error);
        } finally {
            setQuickActionLoadingId(null);
        }
    };

    if (loading) return <LoadingState label="Carregando manutenções..." />;

    const statusCounts = maintenances.reduce<Record<string, number>>((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
    }, {});

    return (
        <Page>
            <PageHeader
                title="Manutenção"
                description="Ordens de serviço: acompanhe reparos, pagamentos e entregas."
                actions={<Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>Nova ordem de serviço</Button>}
            />

            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
                <StatCard label="Faturamento" value={formatBRL(metrics.total)} icon={DollarSign} tone="primary" hint={`${processedMaintenances.length} ordens no período`} className="col-span-2 md:col-span-1" />
                <StatCard label="Em andamento" value={metrics.pending} icon={Wrench} tone="warning" hint="Aguardando ou em reparo" />
                <StatCard label="Concluídas" value={metrics.completed} icon={CheckCircle} tone="success" />
                <StatCard label="Pagas" value={metrics.paid} icon={CreditCard} tone="info" />
                <StatCard label="A receber" value={metrics.unpaid} icon={AlertCircle} tone="danger" hint="Ordens sem pagamento" />
            </div>

            <Card padded={false} className="overflow-hidden">
                {/* Filtros */}
                <div className="space-y-3 border-b border-line p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <Segmented
                                value={period === "custom_month" ? ("" as "today") : period}
                                onChange={(v) => setPeriod(v)}
                                options={[
                                    { value: "today", label: "Hoje" },
                                    { value: "week", label: "7 dias" },
                                    { value: "month", label: "Mês" },
                                    { value: "year", label: "Ano" },
                                    { value: "custom_range", label: "Período" },
                                ]}
                            />
                            {period === "custom_range" && (
                                <div className="basis-full pt-1">
                                    <DateRangeFilter value={range} onChange={setRange} />
                                </div>
                            )}
                        </div>
                        <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Cliente, aparelho, defeito..." className="w-full lg:w-72" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setStatusFilter("all")}
                            className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${statusFilter === "all" ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:bg-hover"}`}
                        >
                            Todos os status
                        </button>
                        {(Object.entries(statusConfig) as [Maintenance["status"], typeof statusConfig[Maintenance["status"]]][]).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${statusFilter === key ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:bg-hover"}`}
                            >
                                {cfg.label}
                                {statusCounts[key] ? <span className="ml-1.5 opacity-60">{statusCounts[key]}</span> : null}
                            </button>
                        ))}
                        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
                        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="ui-input h-8 w-auto text-xs">
                            <option value="all">Qualquer pagamento</option>
                            <option value="paid">Pagas</option>
                            <option value="pending">A receber</option>
                        </select>
                    </div>
                </div>

                {processedMaintenances.length === 0 ? (
                    <EmptyState
                        icon={Wrench}
                        title="Nenhuma ordem de serviço"
                        description="Não há manutenções para os filtros selecionados."
                        action={<Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>Nova ordem de serviço</Button>}
                    />
                ) : (
                    <>
                    <ul className="lg:hidden divide-y divide-line">
                        {processedMaintenances.map((m) => {
                            const cfg = statusConfig[m.status] || statusConfig.pending;
                            const StatusIcon = cfg.icon;
                            const isBusy = quickActionLoadingId === m.id;
                            const created = new Date(m.createdAt);
                            return (
                                <ListRow
                                    key={m.id}
                                    leading={
                                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle border border-line text-xs font-semibold text-fg-muted">
                                            {initials(m.customer)}
                                        </span>
                                    }
                                    title={<>{m.customer || "Cliente"} <span className="font-normal text-fg-subtle">· {m.device || "Aparelho"}{m.model ? ` ${m.model}` : ""}</span></>}
                                    value={formatBRL(m.value)}
                                    subtitle={<span className="line-clamp-2">{m.issue || "Sem descrição"} · {isNaN(created.getTime()) ? "—" : created.toLocaleDateString("pt-BR")}</span>}
                                    meta={<>
                                        <Badge tone={cfg.tone}><StatusIcon size={12} /> {cfg.label}</Badge>
                                        <button onClick={() => togglePaidStatus(m)} disabled={isBusy} className="disabled:opacity-50">
                                            {isBusy ? <Loader size={14} className="animate-spin text-fg-subtle" />
                                                : m.paid ? <Badge tone="success" dot>Pago</Badge> : <Badge tone="danger" dot>A receber</Badge>}
                                        </button>
                                    </>}
                                    actions={<>
                                        {nextStatusLabel[m.status] && (
                                            <IconButton icon={ChevronsRight} label={nextStatusLabel[m.status]!} tone="primary" disabled={isBusy} onClick={() => advanceStatus(m)} />
                                        )}
                                        <IconButton icon={Printer} label="Imprimir O.S." onClick={() => handlePrintOS(m)} />
                                        <IconButton icon={Edit2} label="Editar" onClick={() => openEditModal(m)} />
                                        <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDelete(m.id)} />
                                    </>}
                                />
                            );
                        })}
                    </ul>
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="ui-table min-w-[980px]">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Aparelho</th>
                                    <th>Defeito</th>
                                    <th>Status</th>
                                    <th className="!text-right">
                                        <button onClick={toggleSort} className="inline-flex items-center gap-1 hover:text-fg">
                                            Valor {sortDirection === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                                        </button>
                                    </th>
                                    <th>Pagamento</th>
                                    <th>Entrada</th>
                                    <th className="!text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedMaintenances.map((m) => {
                                    const cfg = statusConfig[m.status] || statusConfig.pending;
                                    const StatusIcon = cfg.icon;
                                    const isBusy = quickActionLoadingId === m.id;
                                    const created = new Date(m.createdAt);
                                    return (
                                        <tr key={m.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle border border-line text-xs font-semibold text-fg-muted">
                                                        {initials(m.customer)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-fg truncate">{m.customer || "—"}</p>
                                                        {m.phone && <p className="text-xs text-fg-subtle inline-flex items-center gap-1"><Phone size={10} /> {m.phone}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <p className="text-fg">{m.device || "—"}</p>
                                                <p className="text-xs text-fg-subtle">{[m.brand, m.model].filter(Boolean).join(" · ")}</p>
                                            </td>
                                            <td className="max-w-[240px]"><p className="truncate" title={m.issue}>{m.issue}</p></td>
                                            <td>
                                                <Badge tone={cfg.tone}><StatusIcon size={12} /> {cfg.label}</Badge>
                                            </td>
                                            <td className="text-right font-semibold text-fg tabular">{formatBRL(m.value)}</td>
                                            <td>
                                                <button
                                                    onClick={() => togglePaidStatus(m)}
                                                    disabled={isBusy}
                                                    title="Clique para alternar"
                                                    className="disabled:opacity-50"
                                                >
                                                    {isBusy ? <Loader size={14} className="animate-spin text-fg-subtle" />
                                                        : m.paid ? <Badge tone="success" dot>Pago</Badge> : <Badge tone="danger" dot>A receber</Badge>}
                                                </button>
                                            </td>
                                            <td className="tabular whitespace-nowrap">
                                                <span className="text-fg">{created.toLocaleDateString("pt-BR")}</span>
                                                <span className="ml-1.5 text-xs text-fg-subtle">{created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-end gap-0.5">
                                                    {nextStatusLabel[m.status] && (
                                                        <IconButton icon={ChevronsRight} label={nextStatusLabel[m.status]!} tone="primary" disabled={isBusy} onClick={() => advanceStatus(m)} />
                                                    )}
                                                    <IconButton icon={Printer} label="Imprimir O.S." onClick={() => handlePrintOS(m)} />
                                                    <IconButton icon={Edit2} label="Editar" onClick={() => openEditModal(m)} />
                                                    <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDelete(m.id)} />
                                                </div>
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

            {/* MODAIS */}

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
        </Page>
    );
}
