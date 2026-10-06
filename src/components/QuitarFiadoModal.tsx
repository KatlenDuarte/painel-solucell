// src/components/QuitarFiadoModal.tsx

import React, { useMemo, useState } from "react";
import {
    X,
    Smartphone,
    CreditCard,
    DollarSign,
    CheckCircle2
} from "lucide-react";

import {
    doc,
    updateDoc,
    serverTimestamp
} from "../lib/firestore";

import { db } from "../lib/firebase";

interface Props {
    saleId: string;
    clientName: string;
    total: number;
    onClose: () => void;
    onSuccess: () => void;
}

type PaymentMethod =
    | "PIX"
    | "Cartão"
    | "Dinheiro"
    | "Múltiplos";

export default function QuitarFiadoModal({
    saleId,
    clientName,
    total,
    onClose,
    onSuccess
}: Props) {

    const [loading, setLoading] = useState(false);

    const [paymentMethod, setPaymentMethod] =
        useState<PaymentMethod>("PIX");

    const [pix, setPix] = useState("");
    const [cartao, setCartao] = useState("");
    const [dinheiro, setDinheiro] = useState("");

    const pixValue = Number(pix) || 0;
    const cartaoValue = Number(cartao) || 0;
    const dinheiroValue = Number(dinheiro) || 0;

    const totalInformado = useMemo(() => {
        return pixValue + cartaoValue + dinheiroValue;
    }, [pixValue, cartaoValue, dinheiroValue]);

    const diferenca = total - totalInformado;

    const canSave =
        paymentMethod !== "Múltiplos"
            ? true
            : Number(totalInformado.toFixed(2)) ===
            Number(total.toFixed(2));

    const handleConfirm = async () => {

        if (!canSave) {
            alert(
                "A soma dos pagamentos deve ser igual ao valor do fiado."
            );
            return;
        }

        try {

            setLoading(true);

            const payload: any = {
                status: "fiado_quitado",
                paidAt: serverTimestamp()
            };

            if (paymentMethod === "Múltiplos") {

                payload.paymentMethod = "Múltiplos";

                payload.payments = {
                    pix: pixValue,
                    cartao: cartaoValue,
                    dinheiro: dinheiroValue
                };

            } else {

                payload.paymentMethod = paymentMethod;

            }

            await updateDoc(
                doc(db, "sales", saleId),
                payload
            );

            onSuccess();
            onClose();

        } catch (error) {

            console.error(error);
            alert("Erro ao quitar fiado.");

        } finally {

            setLoading(false);

        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">

                {/* HEADER */}

                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">

                    <div>
                        <h2 className="text-lg font-semibold text-slate-50">
                            Quitar Fiado
                        </h2>

                        <p className="text-xs text-slate-500 mt-1">
                            Registrar pagamento
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-50 transition-colors"
                    >
                        <X size={18} />
                    </button>

                </div>

                {/* BODY */}

                <div className="p-5 space-y-5">

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">

                        <p className="text-xs text-slate-500 font-semibold">
                            Cliente
                        </p>

                        <p className="text-slate-50 font-bold mt-1">
                            {clientName}
                        </p>

                        <div className="mt-4">

                            <p className="text-xs text-slate-500 font-semibold">
                                Valor do Fiado
                            </p>

                            <p className="text-2xl font-semibold text-emerald-400 mt-1">
                                R$ {total.toFixed(2)}
                            </p>

                        </div>

                    </div>

                    {/* FORMAS */}

                    <div>

                        <p className="text-xs font-semibold text-slate-400 mb-3">
                            Forma de pagamento
                        </p>

                        <div className="grid grid-cols-2 gap-2">

                            <button
                                onClick={() =>
                                    setPaymentMethod("PIX")
                                }
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${paymentMethod === "PIX"
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                        : "border-slate-800 text-slate-400"
                                    }`}
                            >
                                <Smartphone size={14} />
                                PIX
                            </button>

                            <button
                                onClick={() =>
                                    setPaymentMethod("Cartão")
                                }
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${paymentMethod === "Cartão"
                                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                                        : "border-slate-800 text-slate-400"
                                    }`}
                            >
                                <CreditCard size={14} />
                                Cartão
                            </button>

                            <button
                                onClick={() =>
                                    setPaymentMethod("Dinheiro")
                                }
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${paymentMethod === "Dinheiro"
                                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                        : "border-slate-800 text-slate-400"
                                    }`}
                            >
                                <DollarSign size={14} />
                                Dinheiro
                            </button>

                            <button
                                onClick={() =>
                                    setPaymentMethod("Múltiplos")
                                }
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${paymentMethod === "Múltiplos"
                                        ? "border-purple-500 bg-purple-500/10 text-purple-400"
                                        : "border-slate-800 text-slate-400"
                                    }`}
                            >
                                <CheckCircle2 size={14} />
                                Múltiplos
                            </button>

                        </div>

                    </div>

                    {/* MULTIPLOS */}

                    {paymentMethod === "Múltiplos" && (

                        <div className="space-y-3">

                            <input
                                type="number"
                                step="0.01"
                                value={pix}
                                onChange={(e) =>
                                    setPix(e.target.value)
                                }
                                placeholder="Valor PIX"
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-50 outline-none"
                            />

                            <input
                                type="number"
                                step="0.01"
                                value={cartao}
                                onChange={(e) =>
                                    setCartao(e.target.value)
                                }
                                placeholder="Valor Cartão"
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-50 outline-none"
                            />

                            <input
                                type="number"
                                step="0.01"
                                value={dinheiro}
                                onChange={(e) =>
                                    setDinheiro(e.target.value)
                                }
                                placeholder="Valor Dinheiro"
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-50 outline-none"
                            />

                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">

                                <div className="flex justify-between text-sm">

                                    <span className="text-slate-500">
                                        Total informado
                                    </span>

                                    <span className="text-slate-50 font-bold">
                                        R$ {totalInformado.toFixed(2)}
                                    </span>

                                </div>

                                <div className="flex justify-between text-sm mt-2">

                                    <span className="text-slate-500">
                                        Diferença
                                    </span>

                                    <span
                                        className={
                                            diferenca === 0
                                                ? "text-emerald-400 font-bold"
                                                : "text-rose-400 font-bold"
                                        }
                                    >
                                        R$ {diferenca.toFixed(2)}
                                    </span>

                                </div>

                            </div>

                        </div>

                    )}

                </div>

                {/* FOOTER */}

                <div className="border-t border-slate-800 p-4 flex gap-3">

                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-3 text-sm font-bold text-slate-400"
                    >
                        Cancelar
                    </button>

                    <button
                        disabled={!canSave || loading}
                        onClick={handleConfirm}
                        className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-xl py-3 text-sm font-bold text-white"
                    >
                        {loading
                            ? "Salvando..."
                            : "Confirmar"}
                    </button>

                </div>

            </div>

        </div>
    );
}