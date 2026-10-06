import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  DollarSign,
  Calendar,
  Wrench,
  CheckSquare,
  Clock,
  Package,
  Phone,
  User,
  Smartphone,
  FileText,
  Loader2,
  AlertCircle,
  CreditCard
} from "lucide-react";

import { updateMaintenance as updateMaintenanceService } from "../services/maintenanceService";

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

interface EditMaintenanceModalProps {
  maintenance: Maintenance;
  onClose: () => void;
  onUpdate: () => void;
}

const statusOptions = [
  {
    value: "pending",
    label: "Aguardando",
    icon: Clock,
    color: "text-amber-400"
  },
  {
    value: "parts_ordered",
    label: "Peça Pedida",
    icon: Package,
    color: "text-blue-400"
  },
  {
    value: "in_progress",
    label: "Em Reparo",
    icon: Wrench,
    color: "text-purple-400"
  },
  {
    value: "completed",
    label: "Concluído",
    icon: CheckSquare,
    color: "text-emerald-400"
  },
  {
    value: "cancelled",
    label: "Cancelado",
    icon: X,
    color: "text-red-400"
  }
];

const brands = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Motorola",
  "LG",
  "Asus",
  "Realme",
  "Outro"
];

const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({
  maintenance,
  onClose,
  onUpdate
}) => {
  const [formData, setFormData] = useState<Maintenance>(maintenance);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(maintenance);
  }, [maintenance]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type, checked } =
      e.target as HTMLInputElement;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleNumericChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    setError(null);

    try {
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
        notes: formData.notes
      };

      await updateMaintenanceService(
        maintenance.id,
        updatedData
      );

      onUpdate();

      onClose();
    } catch (err) {
      console.error(err);

      setError(
        "Erro ao salvar as alterações. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">

      <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">

        {/* HEADER */}

        <div className="relative overflow-hidden border-b border-slate-800 px-5 md:px-8 py-6">

          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-emerald-500/10" />

          <div className="relative flex items-start justify-between gap-4">

            <div className="flex items-center gap-4">

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg">
                <Wrench className="w-7 h-7 text-white" />
              </div>

              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
                  Editar Manutenção
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Atualize informações da ordem de serviço
                </p>

                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-500">
                    ID
                  </span>

                  <span className="text-xs font-bold text-blue-400">
                    #{maintenance.id.substring(0, 6)}
                  </span>
                </div>

              </div>

            </div>

            <button
              onClick={onClose}
              className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-50 hover:border-slate-700 transition-all"
            >
              <X size={20} />
            </button>

          </div>

        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 md:p-8 space-y-6"
        >

          {/* ERROR */}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4">

              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>

              <div>
                <p className="text-red-400 font-bold text-sm">
                  Erro ao atualizar
                </p>

                <p className="text-red-300/80 text-sm mt-1">
                  {error}
                </p>
              </div>

            </div>
          )}

          {/* CLIENTE */}

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 md:p-6">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-400" />
              </div>

              <div>
                <h3 className="text-slate-50 font-bold">
                  Informações do Cliente
                </h3>

                <p className="text-slate-500 text-xs">
                  Dados do responsável pelo aparelho
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-2">
                  Nome do Cliente
                </label>

                <input
                  type="text"
                  name="customer"
                  value={formData.customer}
                  onChange={handleChange}
                  placeholder="Ex: João Silva"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-2">
                  Telefone
                </label>

                <div className="relative">

                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />

                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(31) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all"
                    required
                  />

                </div>
              </div>

            </div>

          </section>

          {/* APARELHO */}

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 md:p-6">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>

              <div>
                <h3 className="text-slate-50 font-bold">
                  Informações do Aparelho
                </h3>

                <p className="text-slate-500 text-xs">
                  Modelo e fabricante
                </p>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-2">
                  Aparelho
                </label>

                <input
                  type="text"
                  name="device"
                  value={formData.device}
                  onChange={handleChange}
                  placeholder="Ex: iPhone 15"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-2">
                  Marca
                </label>

                <select
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Selecione...
                  </option>

                  {brands.map((brand) => (
                    <option
                      key={brand}
                      value={brand}
                    >
                      {brand}
                    </option>
                  ))}

                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 font-bold mb-2">
                  Modelo
                </label>

                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="Ex: A55"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-blue-500"
                />
              </div>

            </div>

          </section>

          {/* PROBLEMA */}

          <section className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-5 md:p-6">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>

              <div>
                <h3 className="text-slate-50 font-bold">
                  Problema Relatado
                </h3>

                <p className="text-slate-500 text-xs">
                  Descrição do defeito informado
                </p>
              </div>

            </div>

            <textarea
              name="issue"
              value={formData.issue}
              onChange={handleChange}
              rows={4}
              placeholder="Descreva o problema..."
              className="w-full bg-slate-950 border border-amber-500/10 rounded-2xl px-4 py-4 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-amber-500 resize-none"
              required
            />

          </section>

          {/* STATUS E VALORES */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* STATUS */}

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 md:p-6">

              <div className="flex items-center gap-3 mb-6">

                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-purple-400" />
                </div>

                <div>
                  <h3 className="text-slate-50 font-bold">
                    Status da Ordem
                  </h3>

                  <p className="text-slate-500 text-xs">
                    Atualize o andamento do serviço
                  </p>
                </div>

              </div>

              <div className="space-y-4">

                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-2">
                    Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-purple-500"
                  >
                    {statusOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">

                  <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 cursor-pointer hover:border-slate-700 transition-all">

                    <input
                      type="checkbox"
                      name="paid"
                      checked={formData.paid}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        Pago
                      </p>

                      <p className="text-[11px] text-slate-500">
                        Serviço quitado
                      </p>
                    </div>

                  </label>

                  <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 cursor-pointer hover:border-slate-700 transition-all">

                    <input
                      type="checkbox"
                      name="partOrdered"
                      checked={formData.partOrdered}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        Peça Pedida
                      </p>

                      <p className="text-[11px] text-slate-500">
                        Aguardando chegada
                      </p>
                    </div>

                  </label>

                </div>

              </div>

            </section>

            {/* FINANCEIRO */}

            <section className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-5 md:p-6">

              <div className="flex items-center gap-3 mb-6">

                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>

                <div>
                  <h3 className="text-slate-50 font-bold">
                    Financeiro e Datas
                  </h3>

                  <p className="text-slate-500 text-xs">
                    Valores e previsão de entrega
                  </p>
                </div>

              </div>

              <div className="space-y-4">

                <div>
                  <label className="block text-[11px] text-slate-500 font-bold mb-2">
                    Valor do Serviço
                  </label>

                  <div className="relative">

                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />

                    <input
                      type="number"
                      name="value"
                      value={formData.value}
                      onChange={handleNumericChange}
                      step="0.01"
                      min="0"
                      className="w-full bg-slate-950 border border-emerald-500/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 outline-none focus:border-emerald-500"
                    />

                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold mb-2">
                      Pedido da Peça
                    </label>

                    <div className="relative">

                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />

                      <input
                        type="date"
                        name="orderDate"
                        value={formData.orderDate || ""}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 outline-none focus:border-emerald-500"
                      />

                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold mb-2">
                      Entrega
                    </label>

                    <div className="relative">

                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />

                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate || ""}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 outline-none focus:border-emerald-500"
                      />

                    </div>
                  </div>

                </div>

              </div>

            </section>

          </div>

          {/* OBSERVAÇÕES */}

          <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 md:p-6">

            <div className="flex items-center gap-3 mb-6">

              <div className="w-10 h-10 rounded-xl bg-slate-700/40 flex items-center justify-center">
                <FileText className="w-5 h-5 text-slate-300" />
              </div>

              <div>
                <h3 className="text-slate-50 font-bold">
                  Observações Internas
                </h3>

                <p className="text-slate-500 text-xs">
                  Informações adicionais sobre a manutenção
                </p>
              </div>

            </div>

            <textarea
              name="notes"
              value={formData.notes || ""}
              onChange={handleChange}
              rows={4}
              placeholder="Adicione observações..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-slate-50 placeholder:text-slate-600 outline-none focus:border-slate-600 resize-none"
            />

          </section>

          {/* FOOTER */}

          <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 pt-5 flex flex-col md:flex-row gap-3 justify-end">

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 rounded-2xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition-all disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
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