// components/EditSaleModal.tsx
import React, { useState, useEffect } from "react";
import { X, Save, CreditCard, Smartphone, DollarSign, Layers3, Plus, Trash2 } from "lucide-react";
import { doc, updateDoc } from "../lib/firestore";
import { db } from "../lib/firebase";

interface MultiplePayment {
    method: string;
    value: number;
}

interface SaleWithClient {
    id: string;
    total: number;
    payment: string;
    multiplePayments?: MultiplePayment[];
}

interface EditSaleModalProps {
    sale: SaleWithClient | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

interface FirestoreUpdateData {
    total: number;
    paymentMethod: string;
    multiplePayments: MultiplePayment[] | null;
    payments: {
        pix: number;
        cartao: number;
        dinheiro: number;
    };
}

const paymentOptions = [
    { label: "PIX", icon: Smartphone },
    { label: "CARTÃO", icon: CreditCard },
    { label: "DINHEIRO", icon: DollarSign },
    { label: "Fiado", icon: CreditCard },
    { label: "Múltiplos", icon: Layers3 }
];

export default function EditSaleModal({ sale, isOpen, onClose, onSave }: EditSaleModalProps) {
    const [formData, setFormData] = useState({ total: 0, payment: "" });
    const [multiplePayments, setMultiplePayments] = useState<MultiplePayment[]>([]);

    useEffect(() => {
        if (sale) {
            const hasMultiple = sale.multiplePayments && sale.multiplePayments.length > 0;
            setFormData({
                total: sale.total,
                payment: hasMultiple ? "Múltiplos" : sale.payment
            });
            setMultiplePayments(sale.multiplePayments || [{ method: "PIX", value: 0 }]);
        }
    }, [sale]);

    const updateMultiplePayment = (index: number, field: "method" | "value", value: string | number) => {
        const updated = [...multiplePayments];
        updated[index] = { ...updated[index], [field]: value };
        setMultiplePayments(updated);
    };

    const addPaymentRow = () => {
        setMultiplePayments([...multiplePayments, { method: "PIX", value: 0 }]);
    };

    const removePaymentRow = (index: number) => {
        setMultiplePayments(multiplePayments.filter((_, i) => i !== index));
    };

    const totalMultiple = multiplePayments.reduce((acc, item) => acc + Number(item.value || 0), 0);
    const isMultipleError = formData.payment === "Múltiplos" && totalMultiple !== formData.total;

    const handleSave = async () => {
        if (!sale || isMultipleError) return;

        try {
            const saleRef = doc(db, "sales", sale.id);
            let updateData: FirestoreUpdateData;

            if (formData.payment === "Múltiplos") {
                const sumByMethod = (methodKey: string) =>
                    multiplePayments
                        .filter((p) => p.method.toUpperCase().includes(methodKey))
                        .reduce((acc, curr) => acc + Number(curr.value), 0);

                updateData = {
                    total: Number(formData.total),
                    paymentMethod: "Múltiplos",
                    multiplePayments: multiplePayments,
                    payments: {
                        pix: sumByMethod("PIX"),
                        cartao: sumByMethod("CART"),
                        dinheiro: sumByMethod("DIN")
                    }
                };
            } else {
                updateData = {
                    total: Number(formData.total),
                    paymentMethod: formData.payment,
                    multiplePayments: null,
                    payments: {
                        pix: formData.payment === "PIX" ? Number(formData.total) : 0,
                        cartao: formData.payment === "CARTÃO" ? Number(formData.total) : 0,
                        dinheiro: formData.payment === "DINHEIRO" ? Number(formData.total) : 0
                    }
                };
            }

            await updateDoc(saleRef, updateData as any);
            onSave();
            onClose();
        } catch (error) {
            console.error("Erro ao atualizar venda:", error);
            alert("Erro ao salvar alterações");
        }
    };

    if (!isOpen || !sale) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            {/* Modal Container: max-w-2xl para ficar mais largo, max-h-[85vh] para não cortar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl flex flex-col my-auto max-h-[85vh]">
                
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                    <div>
                        <p className="text-[11px] font-medium text-slate-400">
                            Gerenciamento
                        </p>
                        <h2 className="text-lg font-semibold text-slate-100">
                            Editar Venda
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* BODY (Rolagem interna suave se necessário) */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* TOTAL */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">
                            Valor total
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                                R$
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.total}
                                onChange={(e) => setFormData({ ...formData, total: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xl font-medium text-slate-100 outline-none focus:border-slate-700 transition-colors"
                            />
                        </div>
                    </div>

                    {/* MÉTODOS DE PAGAMENTO */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">
                            Forma de pagamento
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {paymentOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = formData.payment === option.label;

                                return (
                                    <button
                                        key={option.label}
                                        onClick={() => setFormData({ ...formData, payment: option.label })}
                                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                                            isSelected
                                                ? "bg-slate-100 border-slate-100 text-slate-950"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                        }`}
                                    >
                                        <Icon size={15} className="shrink-0" />
                                        <span className="text-xs font-medium tracking-wide">
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* MÚLTIPLOS PAGAMENTOS */}
                    {formData.payment === "Múltiplos" && (
                        <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-300">
                                    Divisão de valores
                                </span>
                                <button
                                    onClick={addPaymentRow}
                                    className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <Plus size={12} />
                                    Adicionar forma
                                </button>
                            </div>

                            <div className="space-y-2">
                                {multiplePayments.map((payment, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                        <select
                                            value={payment.method}
                                            onChange={(e) => updateMultiplePayment(index, "method", e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-700 h-9"
                                        >
                                            <option value="PIX">PIX</option>
                                            <option value="CARTÃO">CARTÃO</option>
                                            <option value="DINHEIRO">DINHEIRO</option>
                                        </select>

                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={payment.value || ""}
                                            onChange={(e) => updateMultiplePayment(index, "value", parseFloat(e.target.value) || 0)}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-700 h-9"
                                        />

                                        <button
                                            onClick={() => removePaymentRow(index)}
                                            className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-colors flex items-center justify-center"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* TOTAIS DA DIVISÃO */}
                            <div className="pt-3 border-t border-slate-800/60 flex justify-between text-xs">
                                <div>
                                    <span className="text-[11px] text-slate-500 block">Informado</span>
                                    <span className="font-medium text-slate-300">
                                        R$ {totalMultiple.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[11px] text-slate-500 block">Diferença</span>
                                    <span className={`font-medium ${totalMultiple === formData.total ? "text-emerald-500" : "text-rose-500"}`}>
                                        R$ {(totalMultiple - formData.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-950/20 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={isMultipleError}
                        className={`px-5 py-2 text-xs font-medium rounded-xl transition-all ${
                            isMultipleError
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-slate-100 text-slate-950 hover:bg-slate-50"
                        }`}
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}