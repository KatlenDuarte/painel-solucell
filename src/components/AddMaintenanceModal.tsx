import React, { useState } from "react"
import {
  X, Smartphone, User, Phone, AlertCircle, Calendar, DollarSign,
  FileText, Package, CreditCard
} from 'lucide-react'

// 💡 IMPORTANTE: Importar a função de serviço
import { addMaintenance } from "../services/maintenanceService"

import Modal from "./MaintenanceModal"

interface AddMaintenanceModalProps {
  onClose: () => void
  // ⚠️ ATUALIZAÇÃO: O onSubmit deve ser chamado após o sucesso do Firebase, 
  // e não mais recebendo 'data' diretamente, mas sim informando a conclusão.
  onSubmit: () => void
  // 💡 NOVO: Receber o e-mail da loja para salvar a manutenção no contexto correto
  storeEmail: string
}

const AddMaintenanceModal: React.FC<AddMaintenanceModalProps> = ({
  onClose,
  onSubmit,
  storeEmail // Recebendo o e-mail da loja
}) => {
  const [loading, setLoading] = useState(false) // Adicionado estado de loading

  const [formData, setFormData] = useState({
    customer: "",
    phone: "",
    device: "",
    brand: "",
    model: "",
    issue: "",
    status: "pending",
    value: "",
    paid: false,
    partOrdered: false,
    orderDate: "",
    deliveryDate: "",
    notes: ""
  })

  const brands = ["Apple", "Samsung", "Xiaomi", "Motorola", "LG", "Asus", "Realme", "Outro"]
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

  // ⚠️ FUNÇÃO AJUSTADA PARA SER ASSÍNCRONA E USAR O SERVIÇO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customer || !formData.phone || !formData.device || !formData.issue) {
      alert("Por favor, preencha todos os campos obrigatórios")
      return
    }

    setLoading(true)

    // Prepara o objeto de dados final
    const maintenanceData = {
      ...formData,
      // Converte o valor para número, garantindo 0 se for inválido
      value: parseFloat(formData.value) || 0,
      // 💡 IMPORTANTE: Inclui o e-mail da loja no objeto de dados
      store: storeEmail,
    }

    try {
      // 🚀 CHAMA O SERVIÇO DE FIREBASE
      await addMaintenance(maintenanceData)

      // Se o salvamento for bem-sucedido:
      onSubmit() // Notifica a página pai para recarregar ou fechar
      onClose()

    } catch (error) {
      console.error("Erro ao adicionar manutenção:", error)
      alert("Falha ao registrar a manutenção. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} size="large">
      {/* Header com gradiente */}
      <div className="relative mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/5 dark:to-emerald-600/5 rounded-t-xl -mx-6 -mt-6" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Nova Manutenção</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Registre um novo serviço de reparo</p>
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
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Cliente</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Nome do Cliente *
              </label>
              <input
                type="text"
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                placeholder="Ex: João Silva"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 98765-4321"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Device Information */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Aparelho</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Aparelho *
              </label>
              <input
                type="text"
                name="device"
                value={formData.device}
                onChange={handleChange}
                placeholder="Ex: iPhone 13 Pro"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Marca
              </label>
              <select
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              >
                <option value="">Selecione...</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
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
                placeholder="Ex: A53 5G"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Issue Description */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-900/5 p-5 rounded-xl border border-amber-200 dark:border-amber-800/30">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Problema Reportado *
          </label>
          <textarea
            name="issue"
            value={formData.issue}
            onChange={handleChange}
            placeholder="Descreva o problema detalhadamente..."
            required
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/30 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 resize-none"
          />
        </div>

        {/* Service Details */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/10 dark:to-purple-900/5 p-5 rounded-xl border border-purple-200 dark:border-purple-800/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Detalhes do Serviço</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Valor do Serviço
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/30 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Parts and Delivery */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-900/5 p-5 rounded-xl border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Peças e Prazos</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
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
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/30 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700/50 transition-all">
              <input
                type="checkbox"
                name="partOrdered"
                checked={formData.partOrdered}
                onChange={handleChange}
                className="w-4 h-4 text-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Peça já foi pedida</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700/50 transition-all">
              <input
                type="checkbox"
                name="paid"
                checked={formData.paid}
                onChange={handleChange}
                className="w-4 h-4 text-emerald-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pagamento recebido</span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            Observações
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Anotações adicionais sobre o serviço..."
            rows={2}
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-all"
            disabled={loading} // Desabilita durante o carregamento
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none"
            disabled={loading} // Desabilita durante o carregamento
          >
            {loading ? "Salvando..." : "Adicionar Manutenção"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AddMaintenanceModal