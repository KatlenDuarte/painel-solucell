import React from "react"
import {X, User, Phone, Smartphone, AlertCircle, Calendar, DollarSign, Package, CheckCircle, Clock, FileText, Wrench, XCircle} from 'lucide-react'
import Modal from "./MaintenanceModal"

interface Maintenance {
  id: number
  customer: string
  phone: string
  device: string
  brand: string
  model: string
  issue: string
  status: string
  value: number
  paid: boolean
  partOrdered: boolean
  orderDate?: string
  deliveryDate: string
  createdAt: string
  notes?: string
}

interface ViewMaintenanceModalProps {
  maintenance: Maintenance
  onClose: () => void
}

const ViewMaintenanceModal: React.FC<ViewMaintenanceModalProps> = ({ maintenance, onClose }) => {
  const statusConfig: any = {
    pending: { label: "Aguardando", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20", bgGradient: "from-amber-500/10 to-amber-600/5", icon: Clock },
    parts_ordered: { label: "Peça Pedida", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20", bgGradient: "from-blue-500/10 to-blue-600/5", icon: Package },
    in_progress: { label: "Em Reparo", color: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20", bgGradient: "from-purple-500/10 to-purple-600/5", icon: Wrench },
    completed: { label: "Concluído", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bgGradient: "from-emerald-500/10 to-emerald-600/5", icon: CheckCircle },
    cancelled: { label: "Cancelado", color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20", bgGradient: "from-red-500/10 to-red-600/5", icon: XCircle }
  }

  const statusData = statusConfig[maintenance.status] || statusConfig.pending
  const StatusIcon = statusData.icon

  return (
    <Modal onClose={onClose} size="large">
      {/* Header com gradiente dinâmico baseado no status */}
      <div className="relative mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <div className={`absolute top-0 left-0 right-0 h-28 bg-gradient-to-br ${statusData.bgGradient} dark:${statusData.bgGradient} rounded-t-xl -mx-6 -mt-6`} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 rounded-xl flex items-center justify-center shadow-xl">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Detalhes da Manutenção</h2>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">ID: #{maintenance.id}</p>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${statusData.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusData.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Customer Information */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Cliente</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Nome</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{maintenance.customer}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Telefone</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                {maintenance.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/10 dark:to-purple-900/5 p-5 rounded-xl border border-purple-200 dark:border-purple-800/30 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Aparelho</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Aparelho</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{maintenance.device}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Marca</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{maintenance.brand}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Modelo</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{maintenance.model || "-"}</p>
            </div>
          </div>
        </div>

        {/* Issue */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-900/5 p-5 rounded-xl border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Problema Reportado</h3>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{maintenance.issue}</p>
        </div>

        {/* Financial Information */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-900/5 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Valor do Serviço</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">R$ {maintenance.value.toFixed(2)}</p>
            {maintenance.paid ? (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                Pagamento Recebido
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-xs font-medium">
                <Clock className="w-3 h-3" />
                Pagamento Pendente
              </span>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-900/5 p-5 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Status da Peça</span>
            </div>
            {maintenance.partOrdered ? (
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-sm font-medium">
                  <Package className="w-4 h-4" />
                  Peça Pedida
                </span>
                {maintenance.orderDate && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    Pedido em: {new Date(maintenance.orderDate).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-sm">
                Peça não pedida
              </span>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-500/10 dark:bg-slate-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Data de Criação</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {new Date(maintenance.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>

          {maintenance.deliveryDate && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-slate-500/10 dark:bg-slate-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Previsão de Entrega</span>
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {new Date(maintenance.deliveryDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {maintenance.notes && (
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-500/10 dark:bg-slate-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Observações</h3>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{maintenance.notes}</p>
          </div>
        )}

        {/* Close Button */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all hover:scale-[1.02]"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ViewMaintenanceModal
