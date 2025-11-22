import React, { useState } from "react"
import {
  X, Smartphone, Save, User, Phone, AlertCircle, Calendar, DollarSign, Package, FileText
} from 'lucide-react'
import Modal from "./MaintenanceModal" // Assumindo que o componente Modal está neste caminho
import toast from 'react-hot-toast' // Importando para notificações

// ⚠️ Importar a função de serviço (Assumindo que está disponível)
import { updateMaintenance } from '../services/maintenanceService'

// Definição de tipo atualizada (ID deve ser string do Firestore)
interface Maintenance {
  id: string // CORREÇÃO: ID deve ser string para Firestore
  store: string // Adicionado, necessário para o update, embora não usado diretamente aqui
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
  createdAt: string // Assumido que existe
  notes?: string
}

interface EditMaintenanceModalProps {
  maintenance: Maintenance
  onClose: () => void
  // O onSubmit agora é chamado APÓS o sucesso da atualização no Firebase
  onSubmit: (data: any) => void
  // Adicionar o email da loja para contexto (embora não necessário para update, é bom manter a consistência)
  storeEmail: string
}

const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({ maintenance, onClose, onSubmit, storeEmail }) => {
  const [loading, setLoading] = useState(false) // Estado para gerenciar o carregamento/salvamento

  // 1. Inicializa o estado do formulário
  const [formData, setFormData] = useState({
    customer: maintenance.customer,
    phone: maintenance.phone,
    device: maintenance.device,
    brand: maintenance.brand,
    model: maintenance.model,
    issue: maintenance.issue,
    status: maintenance.status,
    value: maintenance.value.toString(), // Mantém como string para o input
    paid: maintenance.paid,
    partOrdered: maintenance.partOrdered,
    orderDate: maintenance.orderDate || "",
    deliveryDate: maintenance.deliveryDate,
    notes: maintenance.notes || ""
  })

  const statusOptions = [
    { value: "pending", label: "Aguardando" },
    { value: "parts_ordered", label: "Peça Pedida" },
    { value: "in_progress", label: "Em Reparo" },
    { value: "completed", label: "Concluído" },
    { value: "cancelled", label: "Cancelado" }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }))
  }

  // 2. Lógica de Submissão AGORA CHAMA O FIREBASE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Prepara os dados para o Firestore
    const dataToUpdate = {
      ...formData,
      value: parseFloat(formData.value) || 0, // Converte de volta para número
      // O ID e storeEmail já estão no objeto maintenance original, mas não precisam ser atualizados aqui
    }

    try {
      // ⚠️ CORREÇÃO CRUCIAL: Chama a função de atualização do Firebase
      await updateMaintenance(maintenance.id, dataToUpdate)

      // Sucesso
      toast.success("Manutenção atualizada com sucesso!")

      // Fecha o modal e notifica o pai para recarregar a lista
      onSubmit(dataToUpdate)

    } catch (error) {
      console.error("Erro ao atualizar manutenção:", error)
      toast.error("Falha ao salvar. Verifique o console.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} size="large">
      {/* Header com gradiente azul */}
      <div className="relative mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/5 dark:to-blue-600/5 rounded-t-xl -mx-6 -mt-6" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Editar Manutenção</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Atualize as informações do serviço (ID: <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 p-1 rounded-sm">{maintenance.id.substring(0, 8)}...</span>)</p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Cliente</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cliente
              </label>
              <input
                type="text"
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Telefone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Aparelho</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Aparelho
              </label>
              <input
                type="text"
                name="device"
                value={formData.device}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Marca
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Modelo
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Issue */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-900/5 p-5 rounded-xl border border-amber-200 dark:border-amber-800/30">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Problema Reportado
          </label>
          <textarea
            name="issue"
            value={formData.issue}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            disabled={loading}
          />
        </div>

        {/* Service Details */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-900/5 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Status e Valores</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={loading}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Valor do Serviço
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                step="0.01"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Dates and Parts */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-900/5 p-5 rounded-xl border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Peças e Prazos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Data do Pedido da Peça
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="date"
                  name="orderDate"
                  value={formData.orderDate}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Previsão de Entrega
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="date"
                  name="deliveryDate"
                  value={formData.deliveryDate}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700/50 transition-all flex-1">
              <input
                type="checkbox"
                name="partOrdered"
                checked={formData.partOrdered}
                onChange={handleChange}
                className="w-4 h-4 text-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Peça pedida</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700/50 transition-all flex-1">
              <input
                type="checkbox"
                name="paid"
                checked={formData.paid}
                onChange={handleChange}
                className="w-4 h-4 text-emerald-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-emerald-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pagamento recebido</span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Observações
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Anotações adicionais sobre o serviço..."
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-all"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              "Salvando..."
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default EditMaintenanceModal