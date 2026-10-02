// src/components/RefundConfirmationModal.tsx

import React, { useState } from "react";
import {
    Undo2,
    X,
    Loader2,
    AlertTriangle,
    PackageCheck,
} from "lucide-react";

import {
    doc,
    runTransaction,
    increment,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../lib/firebase";

interface RefundConfirmationModalProps {
    saleId: string | null;
    onClose: () => void;
    onRefundSuccess: (saleId: string) => void;
}

const RefundConfirmationModal: React.FC<RefundConfirmationModalProps> = ({
    saleId,
    onClose,
    onRefundSuccess,
}) => {
    const [loading, setLoading] = useState(false);

    if (!saleId) return null;

    const handleConfirmRefund = async () => {
        if (loading) return;

        setLoading(true);

        const saleRef = doc(db, "sales", saleId);

        try {
            await runTransaction(db, async (transaction) => {
                const saleSnap = await transaction.get(saleRef);

                if (!saleSnap.exists()) {
                    throw new Error("Venda não encontrada.");
                }

                const saleData = saleSnap.data() as any;

                if (saleData.status === "refunded") {
                    throw new Error("Esta venda já foi reembolsada.");
                }

                if (saleData.status === "cancelled") {
                    throw new Error("Esta venda já está cancelada.");
                }

                const items = Array.isArray(saleData.items)
                    ? saleData.items
                    : [];

                for (const item of items) {
                    const productId = item.id;

                    const qty = Number(
                        item.saleQty ||
                            item.quantity ||
                            item.qty ||
                            0
                    );

                    const isNonCatalog = String(productId || "").startsWith(
                        "non-catalog-"
                    );

                    if (!productId || isNonCatalog || qty <= 0) {
                        continue;
                    }

                    const productRef = doc(db, "products", productId);

                    transaction.update(productRef, {
                        stock: increment(qty),
                    });
                }

                transaction.update(saleRef, {
                    status: "refunded",
                    refundedAt: serverTimestamp(),
                    refundReason: "Reembolso manual",
                });
            });

            onRefundSuccess(saleId);
            onClose();
        } catch (error: any) {
            console.error("Erro ao processar reembolso:", error);

            if (error?.code === "resource-exhausted") {
                alert(
                    "Cota do Firestore excedida. Aguarde renovar ou reduza as leituras abertas no sistema."
                );
            } else if (error?.code === "permission-denied") {
                alert(
                    "Permissão negada. Verifique as regras do Firebase para atualizar sales e products."
                );
            } else if (error?.code === "not-found") {
                alert("Venda não encontrada.");
            } else {
                alert(error?.message || "Erro ao processar reembolso.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-orange-500" />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
                    title="Fechar"
                    disabled={loading}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6">
                    <div className="flex items-start gap-3 mb-5">
                        <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                            {loading ? (
                                <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                            ) : (
                                <Undo2 className="w-5 h-5 text-red-400" />
                            )}
                        </div>

                        <div className="pr-8">
                            <p className="text-[9px] uppercase tracking-[0.25em] text-red-400 font-black mb-1">
                                Ação irreversível
                            </p>

                            <h2 className="text-lg font-black text-white">
                                Confirmar reembolso
                            </h2>

                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                A venda será marcada como reembolsada e os
                                produtos cadastrados voltarão para o estoque.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <PackageCheck className="w-4 h-4 text-slate-400" />

                            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                                Venda selecionada
                            </p>
                        </div>

                        <p className="text-xs text-slate-500 break-all">
                            ID:{" "}
                            <span className="text-slate-300 font-bold">
                                {saleId}
                            </span>
                        </p>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />

                        <p className="text-[11px] text-red-200 leading-relaxed">
                            Itens avulsos não alteram estoque. Apenas produtos
                            cadastrados terão a quantidade restaurada.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors font-bold text-xs disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={handleConfirmRefund}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black transition-colors text-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processando
                                </>
                            ) : (
                                <>
                                    <Undo2 className="w-4 h-4" />
                                    Reembolsar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundConfirmationModal;