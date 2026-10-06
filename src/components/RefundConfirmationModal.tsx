// src/components/RefundConfirmationModal.tsx
// Estorno de venda: marca a venda como estornada e devolve os produtos ao estoque,
// tudo na mesma transação (ou faz as duas coisas, ou nenhuma).

import React, { useState } from "react";
import { Undo2, X, PackagePlus, Loader2 } from "lucide-react";
import { refundSale } from "../lib/saleActions";

interface RefundItem { id?: string; name: string; saleQty: number }

interface RefundConfirmationModalProps {
    saleId: string | null;
    /** Itens da venda, só para mostrar o que volta ao estoque. */
    items?: RefundItem[];
    onClose: () => void;
    onRefundSuccess: (saleId: string) => void;
}

const RefundConfirmationModal: React.FC<RefundConfirmationModalProps> = ({ saleId, items, onClose, onRefundSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!saleId) return null;

    const returning = (items || []).filter(i => i.id && !i.id.startsWith("avulso-") && !i.id.startsWith("non-catalog-"));

    const close = () => { if (!loading) { setError(""); onClose(); } };

    const handleConfirmRefund = async () => {
        setLoading(true);
        setError("");
        try {
            await refundSale(saleId);

            onRefundSuccess(saleId);
            onClose();
        } catch (e) {
            console.error("Erro ao estornar venda:", e);
            setError(e instanceof Error ? e.message : "Não foi possível estornar. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={close}>
            <div role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}
                className="relative w-full overflow-hidden rounded-t-3xl border border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-2xl">
                <button onClick={close} disabled={loading} aria-label="Fechar"
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-fg-subtle hover:bg-hover hover:text-fg">
                    <X className="h-5 w-5" />
                </button>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
                    <Undo2 className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-fg">Estornar venda?</h2>
                <p className="mt-1 text-sm text-fg-subtle">A venda deixa de contar no faturamento e os produtos voltam para o estoque.</p>

                {returning.length > 0 && (
                    <div className="mt-4 rounded-xl border border-line bg-subtle p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-subtle"><PackagePlus size={14} /> Volta para o estoque</p>
                        <ul className="space-y-1 text-sm">
                            {returning.map((i, n) => (
                                <li key={`${i.id}-${n}`} className="flex justify-between gap-3">
                                    <span className="truncate text-fg-muted">{i.name}</span>
                                    <span className="shrink-0 font-medium text-fg tabular">+{i.saleQty}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}

                <div className="mt-6 flex gap-2">
                    <button onClick={close} disabled={loading}
                        className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-fg hover:bg-hover">
                        Cancelar
                    </button>
                    <button onClick={handleConfirmRefund} disabled={loading}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Estornar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefundConfirmationModal;
