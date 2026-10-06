import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Minus, Printer, Scan, RefreshCw, BellRing, Package } from "lucide-react";
import JsBarcode from "jsbarcode";

// Interface estendida para conter todos os dados editáveis do produto
interface ProductData {
    id: string;
    name: string;
    brand: string;
    model: string;
    stock: number;
    minStock: number;
    price: number;
    costPrice?: number | null;
    barcode?: string | null;
}

interface LabelActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: ProductData | null;
    onConfirm: (
        quantity: number, // Quantidade de etiquetas para imprimir
        updatedData: {
            newName: string;
            newPrice: number;
            newMinStock: number;
            newStock: number; // <-- ADICIONADO AQUI
            newCostPrice: number | null;
            newBarcode: string | null;
        }
    ) => void;
}

export default function LabelActionModal({ isOpen, onClose, product, onConfirm }: LabelActionModalProps) {
    const [quantity, setQuantity] = useState<number>(1);
    
    // Estados para edição rápida dos dados do produto na etiqueta
    const [newName, setNewName] = useState<string>("");
    const [newPrice, setNewPrice] = useState<string>("0");
    const [newMinStock, setNewMinStock] = useState<string>("0");
    const [newStock, setNewStock] = useState<string>("0"); // <-- ADICIONADO AQUI
    const [newCostPrice, setNewCostPrice] = useState<string>("0");
    const [newBarcode, setNewBarcode] = useState<string>("");

    const hiddenSvgRef = useRef<SVGSVGElement>(null);

    // Inicializa todos os campos quando o modal abre ou o produto muda
    useEffect(() => {
        if (!isOpen || !product) return;

        setNewName(product.name);
        setNewPrice(String(product.price));
        setNewMinStock(String(product.minStock));
        setNewStock(String(product.stock)); // <-- ADICIONADO AQUI
        setNewCostPrice(product.costPrice ? String(product.costPrice) : "0");
        setNewBarcode(product.barcode || "");
        setQuantity(1);
    }, [isOpen, product?.id]);

    if (!isOpen || !product) return null;

    // Gerador de código de barras rápido fictício EAN-13
    const handleGenerateRandomBarcode = () => {
        const randomCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
        setNewBarcode(randomCode);
    };

    const handleConfirmAndPrint = (e: React.FormEvent) => {
        e.preventDefault();

        // Tratamento de segurança contra caracteres de vírgula PT-BR
        const parsedPrice = Number(String(newPrice).replace(",", "."));
        const parsedMinStock = Number(newMinStock);
        const parsedStock = Number(newStock); // <-- ADICIONADO AQUI
        const parsedCostPrice = newCostPrice !== "" ? Number(String(newCostPrice).replace(",", ".")) : null;
        const parsedBarcode = newBarcode.trim() !== "" ? newBarcode.trim() : null;

        // Passa a quantidade de cópias e o pacote com os dados atualizados para o componente Pai tratar
        onConfirm(quantity, {
            newName: newName.trim(),
            newPrice: parsedPrice,
            newMinStock: parsedMinStock,
            newStock: parsedStock, // <-- ADICIONADO AQUI
            newCostPrice: parsedCostPrice,
            newBarcode: parsedBarcode
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden max-h-[90vh] overflow-y-auto style-scrollbar">
                
                {/* Indicador estético superior */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500" />

                {/* Header */}
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <span className="text-xs font-semibold text-amber-500">Impressão & Ajuste Rápido</span>
                        <h3 className="text-lg font-semibold text-slate-50 mt-1 leading-tight">Configurar Etiqueta</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                        type="button"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleConfirmAndPrint} className="space-y-5">
                    
                    {/* SEÇÃO 1: DADOS CADASTRAIS DA ETIQUETA */}
                    <div className="space-y-4 bg-slate-900/30 border border-slate-800/80 rounded-xl p-4">
                        <span className="text-xs font-semibold text-slate-400 block mb-1">Informações Visuais do Produto</span>
                        
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome na Etiqueta</label>
                            <input
                                type="text"
                                required
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* Alterado grid-cols-3 para grid-cols-2 no mobile e 4 colunas no desktop para acomodar o Estoque Atual */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Custo (R$)</label>
                                <input
                                    type="text"
                                    value={newCostPrice}
                                    onChange={(e) => setNewCostPrice(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 focus:border-blue-500 outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Venda (R$)</label>
                                <input
                                    type="text"
                                    required
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            {/* NOVO CAMPO: ESTOQUE ATUAL */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                                    <Package size={12} className="text-blue-500" /> Qtd Estoque
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={newStock}
                                    onChange={(e) => setNewStock(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                                    <BellRing size={12} className="text-amber-500" /> Alerta Mínimo
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={newMinStock}
                                    onChange={(e) => setNewMinStock(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 focus:border-amber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Código de barras */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Código de Barras</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={newBarcode}
                                        onChange={(e) => setNewBarcode(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-50 placeholder-slate-600 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Digite ou bipe o código..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerateRandomBarcode}
                                    className="px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl flex items-center gap-1 transition-colors border border-slate-800 text-xs font-bold"
                                    title="Gerar código de barras"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Gerar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 2: QUANTIDADE DE CÓPIAS PARA IMPRESSÃO */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400">Quantidade de Cópias (Etiquetas)</label>
                        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-2 justify-between">
                            <button 
                                type="button"
                                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-50 transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                            
                            <input 
                                type="number" 
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="bg-transparent text-center text-xl font-semibold text-slate-50 outline-none w-20"
                            />

                            <button 
                                type="button"
                                onClick={() => setQuantity(prev => prev + 1)}
                                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-50 transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Ações operacionais de envio */}
                    <div className="flex gap-2 mt-6 pt-2 border-t border-slate-900">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-lg"
                        >
                            <Printer size={14} /> Confirmar & Imprimir
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}