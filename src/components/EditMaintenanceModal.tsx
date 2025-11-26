import React, { useState, useEffect } from "react";
import { X, Save, DollarSign, Calendar, Info, Wrench, CheckSquare, Clock } from 'lucide-react';
import { updateMaintenance as updateMaintenanceService } from '../services/maintenanceService'; // Importa o serviço de atualização

interface Maintenance {
  id: string;
  customer: string;
  phone: string;
  device: string;
  brand: string;
  model: string;
  issue: string;
  status: "pending" | "parts_ordered" | "in_progress" | "completed" | "cancelled";
  value: number;
  paid: boolean;
  partOrdered: boolean;
  orderDate?: string;
  deliveryDate: string;
  createdAt: string;
  notes?: string;
}

interface EditMaintenanceModalProps {
  maintenance: Maintenance;
  onClose: () => void;
  onUpdate: () => void; // Callback para quando a manutenção for atualizada
}

const statusOptions = [
  { value: "pending", label: "Aguardando", icon: Clock },
  { value: "parts_ordered", label: "Peça Pedida", icon: Clock }, // Supondo que Package é importado
  { value: "in_progress", label: "Em Reparo", icon: Wrench },
  { value: "completed", label: "Concluído", icon: CheckSquare },
  { value: "cancelled", label: "Cancelado", icon: X }, // X para cancelado
];

const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({ maintenance, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<Maintenance>(maintenance);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Atualiza o formulário se a manutenção mudar (útil se o modal for reusado)
    setFormData(maintenance);
  }, [maintenance]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0 // Converte para número, ou 0 se inválido
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Prepara os dados para atualização (apenas os campos que podem ser editados)
      const updatedData: Partial<Maintenance> = {
        customer: formData.customer,
        phone: formData.phone,
        device: formData.device,
        brand: formData.brand,
        model: formData.model,
        issue: formData.issue,
        status: formData.status,
        value: formData.value,
        paid: formData.paid,
        partOrdered: formData.partOrdered,
        orderDate: formData.orderDate,
        deliveryDate: formData.deliveryDate,
        notes: formData.notes,
      };

      await updateMaintenanceService(maintenance.id, updatedData);
      onUpdate(); // Chama o callback para o componente pai recarregar as manutenções
      onClose(); // Fecha o modal
    } catch (err) {
      console.error("Erro ao atualizar manutenção:", err);
      setError("Erro ao salvar as alterações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform scale-95 animate-fade-in-up">
        {/* Header do Modal */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold dark:text-white">Editar Manutenção #{maintenance.id.substring(0, 6)}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X size={24} />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Erro!</strong>
              <span className="block sm:inline"> {error}</span>
            </div>
          )}

          {/* Informações do Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
              <input
                type="text"
                id="customer"
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Informações do Aparelho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="device" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aparelho</label>
              <input
                type="text"
                id="device"
                name="device"
                value={formData.device}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Problema e Notas */}
          <div>
            <label htmlFor="issue" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Problema Relatado</label>
            <textarea
              id="issue"
              name="issue"
              value={formData.issue}
              onChange={handleChange}
              rows={3}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
              required
            ></textarea>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas Internas</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes || ""}
              onChange={handleChange}
              rows={3}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
            ></textarea>
          </div>

          {/* Status e Datas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="orderDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data do Pedido (Peça)</label>
              <input
                type="date"
                id="orderDate"
                name="orderDate"
                value={formData.orderDate || ""}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="deliveryDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Entrega Estimada</label>
              <input
                type="date"
                id="deliveryDate"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Valores e Flags */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="value" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor do Serviço (R$)</label>
              <input
                type="number"
                id="value"
                name="value"
                value={formData.value}
                onChange={handleNumericChange}
                step="0.01"
                min="0"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="paid"
                name="paid"
                checked={formData.paid}
                onChange={handleChange}
                className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 dark:bg-slate-700 dark:border-slate-600"
              />
              <label htmlFor="paid" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">Pago</label>
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="partOrdered"
                name="partOrdered"
                checked={formData.partOrdered}
                onChange={handleChange}
                className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 dark:bg-slate-700 dark:border-slate-600"
              />
              <label htmlFor="partOrdered" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">Peça Encomendada</label>
            </div>
          </div>

          {/* Footer do Modal com Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 text-white rounded-md flex items-center gap-2 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Wrench className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Salvar Edições
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMaintenanceModal;