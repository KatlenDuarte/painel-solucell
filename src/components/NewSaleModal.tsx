import React, { useState, useMemo, useEffect } from "react";
import {
    Plus, X, Search, CreditCard, Users, Tag,
    Check, Trash2, Minus
} from "lucide-react";

import { fetchProducts } from "../services/productsService";
import { registerSaleAndAdjustStock } from "../services/salesService";

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
}

interface SaleItem extends Product {
    saleQty: number;
    total: number;
}

interface NewSaleModalProps {
    onClose: () => void;
    storeEmail: string | null;
    onSaleComplete: () => void;
}

interface SaleData {
    store: string;
    clientName: string;
    clientPhone: string;
    isFiado: boolean;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    total: number;
    items: Array<{
        id: string;
        name: string;
        price: number;
        saleQty: number;
    }>;
}

const formatCurrencyInput = (value: string): [number, string] => {
    let clean = value.replace(/\D/g, "");
    if (!clean) return [0, ""];
    const num = parseInt(clean, 10) / 100;
    const display = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
    }).format(num);
    return [num, display];
};

const NewSaleModal: React.FC<NewSaleModalProps> = ({ onClose, storeEmail, onSaleComplete }) => {
    const [stock, setStock] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFiado, setIsFiado] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);

    useEffect(() => {
        const loadProducts = async () => {
            if (!storeEmail) {
                setIsLoading(false);
                return;
            }

            try {
                const products = await fetchProducts(storeEmail);
                const normalized = products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    stock: p.stock ?? 0,
                }));
                setStock(normalized);
            } catch (error) {
                console.error("Error loading products:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadProducts();
    }, [storeEmail]);


    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDiscountInput(value);
        const [num] = formatCurrencyInput(value);
        setDiscount(num);
    };

    const filteredProducts = stock.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const subtotal = useMemo(
        () => selectedProducts.reduce((sum, item) => sum + item.total, 0),
        [selectedProducts]
    );

    const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

    const handleAddProduct = (product: Product) => {
        if (product.stock === 0) return;

        if (!selectedProducts.find((p) => p.id === product.id)) {
            setSelectedProducts((prev) => [
                ...prev,
                {
                    ...product,
                    saleQty: 1,
                    total: product.price,
                },
            ]);
            setProductSearch("");
        }
    };

    const handleQtyChange = (id: string, qty: number) => {
        const stockItem = stock.find((s) => s.id === id);
        const final = Math.min(Math.max(1, qty), stockItem?.stock || 1);

        setSelectedProducts((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, saleQty: final, total: item.price * final }
                    : item
            )
        );
    };

    const handleRemoveProduct = (id: string) => {
        setSelectedProducts((prev) => prev.filter((i) => i.id !== id));
    };

    const handleFinishSale = async () => {
        if (selectedProducts.length === 0) return alert("Adicione pelo menos um item.");
        if (isFiado && (!clientName || !clientPhone)) return alert("Preencha nome e telefone do cliente.");
        if (!isFiado && !paymentMethod) return alert("Selecione a forma de pagamento.");
        if (!storeEmail) return alert("Erro de autenticação: Email da loja não encontrado.");

        setIsLoading(true);

        try {
            const saleData: SaleData = {
                store: storeEmail,
                clientName: isFiado ? clientName : "Consumidor Final",
                clientPhone: isFiado ? clientPhone : "N/A",
                isFiado,
                paymentMethod: isFiado ? "Fiado" : paymentMethod,
                subtotal,
                discount,
                total,
                items: selectedProducts.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    saleQty: item.saleQty,
                })),
            };

            await registerSaleAndAdjustStock(saleData);

            alert(`Venda registrada com sucesso! Total: R$ ${total.toFixed(2)}`);
            onSaleComplete();
            onClose();
        } catch (err) {
            console.error("Erro ao finalizar venda", err);
            alert("Erro ao finalizar venda. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading && stock.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="text-white text-xl">Carregando produtos...</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl p-6 shadow-xl relative overflow-y-auto max-h-[95vh]">

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-2">
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8 border-b border-slate-800 pb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                        <Plus className="w-6 h-6 text-slate-400" />
                        Nova Venda
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Coluna de Itens do Pedido (3/5) */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full bg-slate-800 border border-slate-700 focus:border-slate-500 rounded-md text-white placeholder-slate-500 transition-colors text-sm"
                            />

                            {productSearch && (
                                <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-56 overflow-y-auto z-20">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleAddProduct(p)}
                                                disabled={p.stock === 0}
                                                className={`w-full px-4 py-2 text-left border-b border-slate-700 last:border-none transition-colors flex justify-between items-center text-sm ${p.stock === 0 ? "bg-slate-900 text-red-400 opacity-60 cursor-not-allowed" : "hover:bg-slate-700/50 text-white"}`}
                                            >
                                                <span>
                                                    {p.name}
                                                    <span className={`text-xs ml-2 font-light ${p.stock === 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {p.stock === 0 ? "(SEM ESTOQUE)" : `(${p.stock})`}
                                                    </span>
                                                </span>
                                                <span className="text-green-400">R$ {p.price.toFixed(2)}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="p-3 text-slate-500 text-center text-sm">Nenhum produto encontrado.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Lista de Produtos Selecionados */}
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {selectedProducts.length === 0 ? (
                                <div className="text-center p-6 bg-slate-800 border border-slate-700 rounded-md">
                                    <p className="text-slate-500 text-sm">Adicione itens para começar a venda.</p>
                                </div>
                            ) : (
                                selectedProducts.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-md border border-slate-700">

                                        <div className="flex-1 pr-4">
                                            <p className="text-white font-medium text-sm">{item.name}</p>
                                            <p className="text-slate-500 text-xs">R$ {item.price.toFixed(2)} / un.</p>
                                        </div>

                                        {/* Contador de Quantidade Minimalista */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty - 1)}
                                                disabled={item.saleQty <= 1}
                                                className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>

                                            <span className="w-4 text-center text-white text-sm font-medium">{item.saleQty}</span>

                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty + 1)}
                                                disabled={item.saleQty >= item.stock}
                                                className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className="text-green-400 font-semibold w-24 text-right text-base ml-4">
                                            R$ {item.total.toFixed(2)}
                                        </p>

                                        <button onClick={() => handleRemoveProduct(item.id)} className="text-red-500 hover:text-white p-1 ml-2">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-5 bg-slate-800 p-4 rounded-lg border border-slate-700">
                        
                        <div className="space-y-3 border-b border-slate-700 pb-4">
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>Subtotal:</span>
                                <span>R$ {subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="text-slate-400 flex items-center gap-2 text-sm">
                                    <Tag className="w-4 h-4 text-slate-500" /> Desconto (R$)
                                </label>

                                <input
                                    type="text"
                                    value={discountInput}
                                    onChange={handleDiscountChange}
                                    className="w-24 text-right px-2 py-1 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                                    placeholder="0,00"
                                />
                            </div>

                            <div className="flex justify-between text-xl font-bold pt-3">
                                <span className="text-white">Total:</span>
                                <span className="text-green-400">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Opção Fiado e Toggle */}
                        <div className="flex items-center justify-between p-3 bg-red-900/10 border border-red-900 rounded-md">
                            <span className="text-red-400 font-medium flex items-center gap-2 text-sm">
                                <CreditCard className="w-4 h-4" /> Venda Fiada?
                            </span>
                            <button
                                onClick={() => {
                                    setIsFiado(!isFiado);
                                    setPaymentMethod("");
                                }}
                                className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-all duration-300 ${isFiado ? "bg-red-500" : "bg-slate-600"
                                    }`}
                            >
                                <div
                                    className={`w-5 h-5 bg-white rounded-full transform transition-all duration-300 ${isFiado ? "translate-x-4" : "translate-x-0"
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Forma de Pagamento */}
                        {!isFiado && (
                            <div className="space-y-1">
                                <label className="text-slate-400 text-sm block">Forma de Pagamento</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 focus:border-slate-500 rounded-md px-3 py-2 text-white text-sm"
                                >
                                    <option value="" disabled>Selecione</option>
                                    <option value="PIX">PIX</option>
                                    <option value="Cartão">Cartão</option>
                                    <option value="Dinheiro">Dinheiro</option>
                                </select>
                            </div>
                        )}

                        {/* Dados do Cliente (Fiado) */}
                        {isFiado && (
                            <div className="p-3 bg-red-900/10 border border-red-900 rounded-md space-y-3">
                                <p className="text-red-400 text-sm font-medium border-b border-red-900 pb-2">
                                    <Users className="w-4 h-4 inline-block mr-1" /> Cliente Fiado
                                </p>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full bg-slate-700 border border-red-700 focus:border-red-500 rounded-md px-3 py-2 text-white text-sm placeholder-red-400/50"
                                    placeholder="Nome (obrigatório)"
                                />
                                <input
                                    type="text"
                                    value={clientPhone}
                                    onChange={(e) => setClientPhone(e.target.value)}
                                    className="w-full bg-slate-700 border border-red-700 focus:border-red-500 rounded-md px-3 py-2 text-white text-sm placeholder-red-400/50"
                                    placeholder="Telefone (obrigatório)"
                                />
                            </div>
                        )}

                        {/* Botão Finalizar Venda */}
                        <button
                            onClick={handleFinishSale}
                            disabled={selectedProducts.length === 0 || isLoading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors text-base disabled:bg-slate-700 disabled:text-slate-500"
                        >
                            {isLoading ? "Processando..." : (
                                <>
                                    <Check className="w-5 h-5" /> Finalizar Venda
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewSaleModal;