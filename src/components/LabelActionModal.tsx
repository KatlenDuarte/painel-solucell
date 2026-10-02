import React, { useState, useEffect } from "react";
import { X, Plus, Minus, Printer } from "lucide-react";

interface LabelActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    onConfirm: (quantity: number) => void;
}

export default function LabelActionModal({ isOpen, onClose, productName, onConfirm }: LabelActionModalProps) {
    const [quantity, setQuantity] = useState<number>(1);

    // Reseta a quantidade sempre que o modal abre para um novo produto
    useEffect(() => {
        if (isOpen) setQuantity(1);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-[#090d16] border border-slate-850 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                
                {/* Indicador estético superior */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500" />

                {/* Header */}
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Fila de Impressão</span>
                        <h3 className="text-lg font-black text-white mt-1 leading-tight">Configurar Etiqueta</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="space-y-4">
                    <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3">
                        <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Produto Selecionado</span>
                        <p className="text-sm font-bold text-slate-200 mt-0.5 line-clamp-2">{productName}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Quantidade de Cópias</label>
                        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-2 justify-between">
                            <button 
                                type="button"
                                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                            
                            <input 
                                type="number" 
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-transparent text-center text-lg font-black text-white outline-none w-20"
                            />

                            <button 
                                type="button"
                                onClick={() => setQuantity(prev => prev + 1)}
                                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 mt-6">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-black uppercase transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm(quantity);
                            onClose();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-500/10"
                    >
                        <Printer size={14} /> Confirmar Adição
                    </button>
                </div>

            </div>
        </div>
    );
}