// src/components/AddMaintenanceModal.tsx

import React, { useState } from "react";

import {
  X,
  Smartphone,
  User,
  Phone,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Package,
  CreditCard,
  Loader,
  ShieldCheck,
  Clock3,
  Wrench,
  BadgeDollarSign,
  ClipboardList,
  Sparkles
} from "lucide-react";

import { addMaintenance } from "../services/maintenanceService";

import Modal from "./MaintenanceModal.tsx";

interface AddMaintenanceModalProps {
  onClose: () => void;
  onSubmit: () => void;
  storeEmail: string;
}

const AddMaintenanceModal: React.FC<AddMaintenanceModalProps> = ({
  onClose,
  onSubmit,
  storeEmail
}) => {
  const [loading, setLoading] = useState(false);

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
  });

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

  const statusOptions = [
    {
      value: "pending",
      label: "Aguardando"
    },
    {
      value: "parts_ordered",
      label: "Peça Pedida"
    },
    {
      value: "in_progress",
      label: "Em Reparo"
    },
    {
      value: "completed",
      label: "Concluído"
    },
    {
      value: "cancelled",
      label: "Cancelado"
    }
  ];

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value
    }));
  };

  // FUNÇÃO QUE DISPARA A IMPRESSÃO PARA O NODEJS LOCAL - CORRIGIDA!
  const imprimirOrdemServico = async (maintenance: any) => {
    try {
      // Montamos o payload exatamente com o que a estrutura de OS do backend precisa
      const dadosImpressao = {
        isOS: true, // <--- ISSO AQUI ATIVA O SEU NOVO LAYOUT DE MANUTENÇÃO NO BACKEND
        customer: maintenance.customer,
        phone: maintenance.phone,
        total: maintenance.value,
        paymentMethod: maintenance.paid ? "Recebido / Antecipado" : "A Pagar na Retirada",
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

      await fetch("http://localhost:3333/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dadosImpressao)
      });
      
    } catch (printError) {
      console.error("Falha ao mandar comando para a Elgin:", printError);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.customer ||
      !formData.phone ||
      !formData.device ||
      !formData.issue
    ) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const maintenanceData = {
        ...formData,
        value: parseFloat(formData.value) || 0,
        store: storeEmail,
        createdAt: new Date().toISOString()
      };

      // 1. Salva no Firebase / Banco de dados
      await addMaintenance(maintenanceData);

      // 2. Dispara a impressão automática passando os dados certos da OS
      await imprimirOrdemServico(maintenanceData);

      onSubmit();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao adicionar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} size="large">

      {/* HEADER */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 mb-6">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_#3b82f6,_transparent_35%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
              <Wrench className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400">
                  Nova Ordem
                </span>
                <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                  Sistema Técnico
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
                Adicionar Manutenção
              </h2>
              <p className="text-slate-500 text-sm mt-2 max-w-xl">
                Registre aparelhos, clientes, pagamentos,
                peças e informações técnicas no sistema.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-all"
            type="button"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* CLIENTE */}
        <section className="bg-slate-900/20 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Cliente
              </h3>
              <p className="text-xs text-slate-500">
                Informações básicas do cliente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Nome do Cliente *
              </label>
              <input
                type="text"
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                placeholder="Ex: João Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Telefone *
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                  size={15}
                />
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(31) 99999-9999"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
        </section>

        {/* APARELHO */}
        <section className="bg-slate-900/20 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Aparelho
              </h3>
              <p className="text-xs text-slate-500">
                Dados do dispositivo recebido.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Aparelho *
              </label>
              <input
                type="text"
                name="device"
                value={formData.device}
                onChange={handleChange}
                placeholder="Ex: iPhone 14"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Marca
              </label>
              <select
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500 transition-all"
              >
                <option value="">Selecionar</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Modelo
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="Ex: A54 5G"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </section>

        {/* PROBLEMA */}
        <section className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Problema Reportado
              </h3>
              <p className="text-xs text-slate-500">
                Descrição técnica do defeito.
              </p>
            </div>
          </div>
          <textarea
            name="issue"
            value={formData.issue}
            onChange={handleChange}
            rows={4}
            placeholder="Descreva o problema detalhadamente..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-slate-50 outline-none resize-none focus:border-amber-500 transition-all"
          />
        </section>

        {/* SERVIÇO */}
        <section className="bg-slate-900/20 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <BadgeDollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Serviço & Pagamento
              </h3>
              <p className="text-xs text-slate-500">
                Controle financeiro e andamento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-purple-500 transition-all"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Valor do Serviço
              </label>
              <div className="relative">
                <DollarSign
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                  size={15}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-50 outline-none focus:border-purple-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/20 transition-all">
              <input
                type="checkbox"
                name="paid"
                checked={formData.paid}
                onChange={handleChange}
                className="accent-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-300">
                Pagamento Recebido
              </span>
            </label>

            <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-blue-500/20 transition-all">
              <input
                type="checkbox"
                name="partOrdered"
                checked={formData.partOrdered}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span className="text-xs font-semibold text-slate-300">
                Peça já foi pedida
              </span>
            </label>
          </div>
        </section>

        {/* PRAZOS */}
        <section className="bg-slate-900/20 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Datas & Entrega
              </h3>
              <p className="text-xs text-slate-500">
                Controle de peças e previsões.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Data do Pedido
              </label>
              <input
                type="date"
                name="orderDate"
                value={formData.orderDate}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-2 block">
                Previsão de Entrega
              </label>
              <input
                type="date"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-50 outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>
        </section>

        {/* OBSERVAÇÕES */}
        <section className="bg-slate-900/20 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-50">
                Observações
              </h3>
              <p className="text-xs text-slate-500">
                Informações extras e anotações internas.
              </p>
            </div>
          </div>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Digite observações adicionais..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-slate-50 outline-none resize-none focus:border-slate-600 transition-all"
          />
        </section>

        {/* ACTIONS */}
        <div className="sticky bottom-0 bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm font-bold transition-all"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Salvando...
              </                >
            ) : (
              <>
                <Sparkles size={16} />
                Adicionar & Imprimir OS
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMaintenanceModal;