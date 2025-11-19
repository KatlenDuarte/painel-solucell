// src/components/RefundConfirmationModal.tsx
// (Completo e refatorado com runTransaction)

import React, { useState } from "react";
import { Undo2, X } from "lucide-react";

// 🔥 FIREBASE - Importamos runTransaction
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";

interface RefundConfirmationModalProps {
    saleId: string | null;
    onClose: () => void;
    onRefundSuccess: (saleId: string) => void; 
}

const RefundConfirmationModal: React.FC<RefundConfirmationModalProps> = ({
    saleId,
    onClose,
    onRefundSuccess
}) => {
    const [loading, setLoading] = useState(false);

    if (!saleId) return null;

    const handleConfirmRefund = async () => {
        setLoading(true);
        
        const saleRef = doc(db, "sales", saleId);

        try {
            await runTransaction(db, async (transaction) => {
                
                // 1. BUSCAR DETALHES DA VENDA (DENTRO DA TRANSAÇÃO)
                const saleSnap = await transaction.get(saleRef);

                if (!saleSnap.exists()) {
                    throw new Error("Venda não encontrada.");
                }

                const saleData = saleSnap.data() as any; 
                
                // Impede o reembolso se já estiver reembolsado
                if (saleData.status === "refunded") {
                    console.log("Transação cancelada: Venda já reembolsada.");
                    // Throwing an error here will cancel the transaction but won't be caught by the outer try/catch
                    // We just return to skip the updates.
                    return; 
                }

                // 2. DEVOLVER PRODUTOS AO ESTOQUE
                for (const item of saleData.items) {
                    const productId = item.id;
                    const refundedQty = item.saleQty;

                    if (productId && refundedQty > 0) {
                        const productRef = doc(db, "products", productId);
                        
                        // Obtém o produto DENTRO da transação
                        const productSnap = await transaction.get(productRef); 

                        if (productSnap.exists()) {
                            const currentStock = productSnap.data().stock || 0;
                            // Novo estoque = Estoque atual + Quantidade reembolsada
                            const newStock = currentStock + refundedQty;

                            // Usa transaction.update
                            transaction.update(productRef, { stock: newStock });
                        } else {
                            // Se o produto não for encontrado, logamos mas deixamos a transação seguir para outros itens.
                            console.warn(`Produto ID ${productId} não encontrado. Estoque não ajustado.`);
                        }
                    }
                }

                // 3. ATUALIZAR STATUS DA VENDA (USA transaction.update)
                transaction.update(saleRef, {
                    status: "refunded",
                });
                
                // Transação finaliza com sucesso.
            });
            
            // Se a transação foi bem-sucedida, chama a callback e fecha o modal.
            onRefundSuccess(saleId);
            onClose();
            
        } catch (error) {
            // Se a transação falhar (ex: erro de permissão, erro de rede), o catch é acionado.
            alert("Erro ao processar reembolso. Verifique as regras de segurança do Firebase e se o ID da venda está correto.");
            console.error("Erro ao processar reembolso e ajustar estoque:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-red-700 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
                    title="Fechar"
                    disabled={loading}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    <Undo2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Confirmar Reembolso</h2>
                    <p className="text-slate-400 mb-6 text-sm">
                        Tem certeza que deseja reembolsar a transação <strong>{saleId}</strong>? O estoque dos itens vendidos será **restaurado**.
                    </p>
                </div>

                <div className="flex justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmRefund}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-red-500/20"
                        disabled={loading}
                    >
                        {loading ? "Processando..." : "Confirmar Reembolso"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefundConfirmationModal;