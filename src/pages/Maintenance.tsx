import React, { useState, useEffect, useCallback } from "react"
import {
  Plus, Search, Filter, Wrench, Clock, CheckCircle, XCircle,
  AlertCircle, Calendar, DollarSign, Package, Phone, User,
  Eye, Trash2
} from 'lucide-react'

// ⚠️ ATUALIZAÇÕES:
// Importar as funções do serviço
import { fetchMaintenances, deleteMaintenance as deleteMaintenanceService } from '../services/maintenanceService'

import AddMaintenanceModal from "../components/AddMaintenanceModal"
import ViewMaintenanceModal from "../components/ViewMaintenanceModal"

interface Maintenance {
  id: string
  customer: string
  phone: string
  device: string
  brand: string
  model: string
  issue: string
  status: "pending" | "parts_ordered" | "in_progress" | "completed" | "cancelled"
  value: number
  paid: boolean
  partOrdered: boolean
  orderDate?: string
  deliveryDate: string
  createdAt: string
  notes?: string
}

// Simulação de hook de autenticação
const useAuth = () => ({
  storeEmail: "minha-loja@exemplo.com"
})

const MaintenancePage = () => {
  const { storeEmail } = useAuth()

  const [loading, setLoading] = useState(true)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null)

  const loadMaintenances = useCallback(async () => {
    if (!storeEmail) {
      console.error("E-mail da loja não disponível para carregar manutenções.")
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMaintenances(storeEmail)
      setMaintenances(data as Maintenance[])
    } catch (error) {
      console.error("Erro ao carregar manutenções:", error)
    } finally {
      setLoading(false)
    }
  }, [storeEmail])

  useEffect(() => {
    loadMaintenances()
  }, [loadMaintenances])

  useEffect(() => {
    const isModalOpen = showAddModal || showViewModal
    document.body.classList.toggle("no-scroll", isModalOpen)
    return () => document.body.classList.remove("no-scroll")
  }, [showAddModal, showViewModal])

  const statusConfig = {
    pending: { label: "Aguardando", color: "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-800/20 dark:border-amber-700/50", icon: Clock },
    parts_ordered: { label: "Peça Pedida", color: "text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-300 dark:bg-blue-800/20 dark:border-blue-700/50", icon: Package },
    in_progress: { label: "Em Reparo", color: "text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-300 dark:bg-purple-800/20 dark:border-purple-700/50", icon: Wrench },
    completed: { label: "Concluído", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-800/20 dark:border-emerald-700/50", icon: CheckCircle },
    cancelled: { label: "Cancelado", color: "text-red-600 bg-red-500/10 border-red-500/20 dark:text-red-300 dark:bg-red-800/20 dark:border-red-700/50", icon: XCircle }
  }

  const filteredMaintenances = maintenances.filter(m => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      m.customer.toLowerCase().includes(term) ||
      m.device.toLowerCase().includes(term) ||
      m.issue.toLowerCase().includes(term)

    const matchesStatus = statusFilter === "all" || m.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openViewModal = (m: Maintenance) => {
    setSelectedMaintenance(m)
    setShowViewModal(true)
  }

  const handleAdd = (data: any) => {
    setShowAddModal(false)
    loadMaintenances()
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta manutenção?")) {
      try {
        await deleteMaintenanceService(id)
        loadMaintenances()
      } catch (error) {
        console.error("Erro ao deletar manutenção:", error)
        alert("Erro ao tentar deletar a manutenção.")
      }
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Manutenções</h1>
          <p className="text-slate-600 dark:text-slate-400">Gerencie serviços de reparo</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg flex items-center gap-2 shadow hover:bg-emerald-600 transition"
        >
          <Plus /> Nova Manutenção
        </button>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, aparelho ou problema..."
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-50 border dark:bg-slate-700 dark:text-white dark:border-slate-600"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-lg bg-slate-50 border dark:bg-slate-700 dark:text-white dark:border-slate-600"
          >
            <option value="all">Todos os Status</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 dark:text-slate-400">
          <Wrench className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
          Carregando manutenções...
        </div>
      )}

      {!loading && filteredMaintenances.length === 0 && (
        <div className="text-center py-8 border rounded-xl bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="dark:text-slate-300">Nenhuma manutenção encontrada.</p>
        </div>
      )}

      {!loading && filteredMaintenances.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Aparelho</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Problema</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Status</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Entrega</th>
                <th className="px-4 py-3 text-left text-xs font-semibold dark:text-slate-400">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold dark:text-slate-400">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-slate-700">
              {filteredMaintenances.map(m => {
                const StatusIcon = statusConfig[m.status].icon

                return (
                  <tr key={m.id} className="dark:text-white">
                    <td className="px-4 py-4">
                      <p className="font-medium">{m.customer}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.phone}</p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium">{m.device}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.brand}</p>
                    </td>

                    <td className="hidden md:table-cell px-4 py-4 max-w-[180px] truncate">
                      {m.issue}
                    </td>

                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs border rounded-full inline-flex items-center gap-1 ${statusConfig[m.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[m.status].label}
                      </span>
                    </td>

                    <td className="hidden md:table-cell px-4 py-4">
                      {m.deliveryDate ? new Date(m.deliveryDate).toLocaleDateString("pt-BR") : "-"}
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      R$ {m.value.toFixed(2)}
                      <p className={`text-xs ${m.paid ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}`}>
                        {m.paid ? "Pago" : "Pendente"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded dark:hover:bg-slate-700" onClick={() => openViewModal(m)}>
                          <Eye className="w-4 h-4 dark:text-white" />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded dark:hover:bg-slate-700" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddMaintenanceModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAdd}
          storeEmail={storeEmail}
        />
      )}

      {showViewModal && selectedMaintenance && (
        <ViewMaintenanceModal
          maintenance={selectedMaintenance}
          onClose={() => {
            setShowViewModal(false)
            setSelectedMaintenance(null)
          }}
        />
      )}

    </div>
  )
}

export default MaintenancePage
