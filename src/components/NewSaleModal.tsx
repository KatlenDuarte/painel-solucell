import React, { useState, useMemo, useEffect } from "react";
import {
    Plus, X, Search, CreditCard, Users, Tag,
    Check, Trash2, Minus, PlusCircle, AlertTriangle
} from "lucide-react";

// Mantenha estas chamadas de serviço intactas
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

interface DistributedPayment {
    method: string;
    value: number;
    valueInput: string;
}

interface SaleData {
    store: string;
    clientName: string;
    clientPhone: string;
    isFiado: boolean;
    // NOVO: Data prevista de pagamento para vendas fiadas
    expectedPaymentDate: string;
    // O paymentMethod agora indica o tipo principal (ex: 'PIX' ou 'Múltiplo')
    paymentMethod: string;
    subtotal: number;
    discount: number;
    total: number;
    // Detalhe das formas de pagamento usadas (necessário para pagamentos múltiplos ou único)
    distributedPayments: Array<{
        method: string;
        value: number;
    }>;
    items: Array<{
        id: string;
        name: string;
        price: number;
        saleQty: number;
    }>;
}

// -----------------------------------------------------------
// FUNÇÃO DE UTILIDADE (MANTIDA)
// -----------------------------------------------------------
const formatCurrencyInput = (raw: string): [number, string] => {
    // Remove tudo que não for número
    let clean = raw.replace(/[^\d]/g, "");

    if (!clean) return [0, ""];

    // Converte automaticamente para decimal
    const num = parseFloat(clean) / 100;

    // Formata no padrão BR
    const display = num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return [num, display];
};

const paymentOptions = ["PIX", "Cartão", "Dinheiro", "Outro"];

// -----------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------
const NewSaleModal: React.FC<NewSaleModalProps> = ({ onClose, storeEmail, onSaleComplete }) => {
    const [stock, setStock] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ESTADOS ATUALIZADOS/NOVOS PARA FIADO
    const [isFiado, setIsFiado] = useState(false);
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [expectedPaymentDate, setExpectedPaymentDate] = useState(""); // NOVO ESTADO

    const [productSearch, setProductSearch] = useState("");

    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");

    const [paymentMethod, setPaymentMethod] = useState(""); // Forma única
    const [useMultiplePayments, setUseMultiplePayments] = useState(false); // Toggle Múltiplo
    const [distributedPayments, setDistributedPayments] = useState<DistributedPayment[]>([]); // Formas distribuídas

    const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);

    const [nonCatalogItem, setNonCatalogItem] = useState({ name: "", price: 0 });
    const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

    // -----------------------------------------------------------
    // EFEITOS E MEMOIZAÇÃO
    // -----------------------------------------------------------
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


    const filteredProducts = stock.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const subtotal = useMemo(
        () => selectedProducts.reduce((sum, item) => sum + item.total, 0),
        [selectedProducts]
    );

    const discountValid = Math.max(0, Math.min(discount, subtotal));
    const total = useMemo(() => Math.max(0, subtotal - discountValid), [subtotal, discountValid]);

    const distributedSum = useMemo(
        () => distributedPayments.reduce((sum, p) => sum + p.value, 0),
        [distributedPayments]
    );

    const remainingToPay = total - distributedSum;

    // -----------------------------------------------------------
    // HANDLERS GERAIS
    // -----------------------------------------------------------

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [num, display] = formatCurrencyInput(e.target.value);
        setDiscount(num);
        setDiscountInput(display);
    };

    const handleNonCatalogPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [num, display] = formatCurrencyInput(e.target.value);
        setNonCatalogPriceInput(display);
        setNonCatalogItem(prev => ({ ...prev, price: num }));
    };

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

    const handleAddNonCatalogItem = () => {
        if (!nonCatalogItem.name.trim() || nonCatalogItem.price <= 0) {
            alert("Preencha o nome e um preço válido para o item avulso.");
            return;
        }

        const newId = `non-catalog-${Date.now()}`;

        const newItem: SaleItem = {
            id: newId,
            name: nonCatalogItem.name.trim(),
            price: nonCatalogItem.price,
            stock: 999999, // Estoque ilimitado para itens avulsos
            saleQty: 1,
            total: nonCatalogItem.price,
        };

        setSelectedProducts((prev) => [...prev, newItem]);
        setNonCatalogItem({ name: "", price: 0 });
        setNonCatalogPriceInput("");
    };


    const handleQtyChange = (id: string, qty: number) => {
        const isNonCatalog = id.startsWith('non-catalog-');
        const stockItem = stock.find((s) => s.id === id);

        const maxStock = isNonCatalog ? 999999 : (stockItem ? stockItem.stock : 1);

        const final = Math.min(Math.max(1, qty), maxStock);

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

    // -----------------------------------------------------------
    // HANDLERS DE PAGAMENTO MÚLTIPLO
    // -----------------------------------------------------------

    const handleToggleMultiplePayments = (value: boolean) => {
        setUseMultiplePayments(value);
        setIsFiado(false); // Não pode ser fiado e múltiplo
        setPaymentMethod("");
        setDistributedPayments([]);
    };

    const handleAddDistributedPayment = () => {
        if (distributedPayments.length >= paymentOptions.length) return;

        // Encontra o primeiro método de pagamento que ainda não foi usado (excluindo 'Outro')
        const availableMethod = paymentOptions.find(
            (opt) => opt !== "Outro" && !distributedPayments.some((p) => p.method === opt)
        ) || "Outro";

        // Se houver saldo restante, preenche o valor com ele
        const initialValue = remainingToPay > 0 ? remainingToPay : 0;
        const initialValueDisplay = initialValue > 0 ? formatCurrencyInput(String(Math.round(initialValue * 100)))[1] : "";

        setDistributedPayments((prev) => [
            ...prev,
            { method: availableMethod, value: initialValue, valueInput: initialValueDisplay },
        ]);
    };

    const handleRemoveDistributedPayment = (index: number) => {
        setDistributedPayments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleDistributedPaymentMethodChange = (
        e: React.ChangeEvent<HTMLSelectElement>,
        index: number
    ) => {
        const newMethod = e.target.value;

        // Previne a seleção de um método já escolhido (exceto "Outro")
        const isMethodTaken = distributedPayments.some(
            (p, i) => i !== index && p.method === newMethod && newMethod !== "Outro"
        );

        if (isMethodTaken) {
            alert(`O método de pagamento "${newMethod}" já foi selecionado.`);
            return;
        }

        setDistributedPayments((prev) =>
            prev.map((item, i) => (i === index ? { ...item, method: newMethod } : item))
        );
    };

    const handleDistributedPaymentValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const [num, display] = formatCurrencyInput(e.target.value);

        setDistributedPayments(prev =>
            prev.map((item, i) =>
                i === index
                    ? { ...item, value: num, valueInput: display }
                    : item
            )
        );
    };


    // -----------------------------------------------------------
    // FINALIZAR VENDA
    // -----------------------------------------------------------
    const handleFinishSale = async () => {
        if (selectedProducts.length === 0) return alert("Adicione pelo menos um item.");

        // VALIDAÇÕES FIADO ATUALIZADAS
        if (isFiado) {
            if (!clientName.trim() || !clientPhone.trim()) return alert("Preencha nome e telefone do cliente para vendas fiadas.");
            if (!expectedPaymentDate.trim()) return alert("Preencha a Data Prevista de Pagamento para vendas fiadas.");
        }

        if (!isFiado) {
            if (useMultiplePayments) {
                if (distributedPayments.length === 0) return alert("Adicione pelo menos uma forma de pagamento distribuída.");

                // Verifica se o total distribuído bate com o total da venda (tolerância de 0.01)
                if (Math.abs(remainingToPay) > 0.01) {
                    return alert(`O total dos pagamentos (R$ ${distributedSum.toFixed(2)}) não corresponde ao Total da Venda (R$ ${total.toFixed(2)}). Falta R$ ${remainingToPay.toFixed(2)}.`);
                }
            } else if (!paymentMethod) {
                return alert("Selecione a forma de pagamento.");
            }
        }

        if (!storeEmail) return alert("Erro de autenticação: Email da loja não encontrado.");

        setIsLoading(true);

        try {
            const finalPayments = isFiado
                ? [] // Fiado é tratado separadamente
                : useMultiplePayments
                    ? distributedPayments.map(p => ({ method: p.method, value: p.value }))
                    : paymentMethod ? [{ method: paymentMethod, value: total }] : [];

            const saleData: SaleData = {
                store: storeEmail,
                clientName: isFiado ? clientName.trim() : "Consumidor Final",
                clientPhone: isFiado ? clientPhone.trim() : "N/A",
                isFiado,
                expectedPaymentDate: isFiado ? expectedPaymentDate : "",
 // NOVO CAMPO
                paymentMethod: isFiado
                    ? "Fiado"
                    : useMultiplePayments
                        ? "Múltiplo"
                        : paymentMethod,
                distributedPayments: finalPayments,
                subtotal,
                discount: discountValid,
                total,
                items: selectedProducts.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    saleQty: item.saleQty,
                })),
            };

            // CHAMA O SERVIÇO EXTERNO
            await registerSaleAndAdjustStock(saleData);

            alert(`Venda registrada com sucesso! Total: R$ ${total.toFixed(2)}`);
            onSaleComplete();
            onClose();
        } catch (err) {
            console.error("Erro ao finalizar venda", err);
            alert("Erro ao finalizar venda. Tente novamente. Verifique o console para detalhes.");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading && selectedProducts.length === 0 && stock.length === 0) {
        return (
            <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50 p-4">
                <div className="text-gray-200 text-xl">Carregando produtos...</div>
            </div>
        );
    }

  return (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-6xl p-6 shadow-2xl relative overflow-y-auto max-h-[95vh]">

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 z-10">
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8 border-b border-gray-700 pb-4">
                    <h2 className="text-2xl font-extrabold text-white flex items-center justify-center gap-2">
                        <Plus className="w-6 h-6 text-green-400" />
                        Nova Venda
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Coluna de Itens do Pedido (3/5) */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar produto cadastrado..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full bg-gray-700 border border-gray-600 focus:border-green-400 rounded-md text-white placeholder-gray-400 transition-colors text-sm"
                            />

                            {productSearch && (
                                <div className="absolute top-full mt-2 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-56 overflow-y-auto z-20">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleAddProduct(p)}
                                                disabled={p.stock === 0}
                                                className={`w-full px-4 py-2 text-left border-b border-gray-600 last:border-none transition-colors flex justify-between items-center text-sm ${p.stock === 0 ? "bg-red-900/50 text-red-400 opacity-60 cursor-not-allowed" : "hover:bg-gray-600 text-gray-200"}`}
                                            >
                                                <span>
                                                    {p.name}
                                                    <span className={`text-xs ml-2 font-light ${p.stock === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                        {p.stock === 0 ? "(SEM ESTOQUE)" : `(${p.stock} em estoque)`}
                                                    </span>
                                                </span>
                                                <span className="text-green-400 font-semibold">R$ {p.price.toFixed(2)}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="p-3 text-gray-400 text-center text-sm">Nenhum produto encontrado.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CAMPO PARA ITEM AVULSO */}
                        <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-md space-y-2">
                            <p className="text-yellow-400 text-sm font-medium flex items-center gap-2 border-b border-yellow-800 pb-2">
                                <PlusCircle className="w-4 h-4 text-yellow-500" /> Adicionar Item Avulso (Não-Catalogado)
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nome do Item/Serviço"
                                    value={nonCatalogItem.name}
                                    onChange={(e) => setNonCatalogItem(prev => ({ ...prev, name: e.target.value }))}
                                    className="flex-grow bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-white text-sm placeholder-gray-400"
                                />
                                <input
                                    type="text"
                                    placeholder="Preço R$"
                                    value={nonCatalogPriceInput}
                                    onChange={handleNonCatalogPriceChange}
                                    className="w-24 text-right bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-white text-sm placeholder-gray-400"
                                />
                                <button
                                    onClick={handleAddNonCatalogItem}
                                    disabled={!nonCatalogItem.name.trim() || nonCatalogItem.price <= 0}
                                    className="bg-yellow-600 hover:bg-yellow-500 text-white p-1.5 rounded-md disabled:bg-gray-600 disabled:opacity-50 transition-colors"
                                    title="Adicionar item avulso"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>


                        {/* Lista de Produtos Selecionados */}
                        <div className="space-y-2 max-h-[30vh] lg:max-h-[50vh] overflow-y-auto pr-1 pt-2 border-t border-gray-700">
                            {selectedProducts.length === 0 ? (
                                <div className="text-center p-6 bg-gray-700 border border-gray-600 rounded-md">
                                    <p className="text-gray-400 text-sm">Adicione itens para começar a venda.</p>
                                </div>
                            ) : (
                                selectedProducts.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg border border-gray-600 shadow-inner">

                                        <div className="flex-1 pr-4">
                                            <p className="text-white font-medium text-sm">
                                                {item.name}
                                                {item.id.startsWith('non-catalog-') && (
                                                    <span className="text-xs ml-2 text-yellow-400 font-normal">(AVULSO)</span>
                                                )}
                                            </p>
                                            <p className="text-gray-400 text-xs">R$ {item.price.toFixed(2)} / un.</p>
                                        </div>

                                        {/* Contador de Quantidade Minimalista */}
                                        <div className="flex items-center gap-2 bg-gray-800 rounded-full p-0.5 border border-gray-600">
                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty - 1)}
                                                disabled={item.saleQty <= 1}
                                                className="text-gray-400 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-gray-700"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>

                                            <span className="w-4 text-center text-white text-sm font-semibold">{item.saleQty}</span>

                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty + 1)}
                                                disabled={!item.id.startsWith('non-catalog-') && item.saleQty >= item.stock}
                                                className="text-gray-400 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-gray-700"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className="text-green-400 font-extrabold w-24 text-right text-base ml-4">
                                            R$ {item.total.toFixed(2)}
                                        </p>

                                        <button onClick={() => handleRemoveProduct(item.id)} className="text-red-400 hover:text-red-300 p-1 ml-2">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Coluna de Resumo da Venda */}
                    <div className="lg:col-span-2 space-y-5 bg-gray-900 p-4 rounded-lg border border-gray-700 h-fit">

                        <div className="space-y-3 border-b border-gray-700 pb-4">
                            <div className="flex justify-between text-gray-400 text-sm">
                                <span>Subtotal:</span>
                                <span>R$ {subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="text-gray-400 flex items-center gap-2 text-sm">
                                    <Tag className="w-4 h-4 text-gray-400" /> Desconto (R$)
                                </label>

                                <input
                                    type="text"
                                    value={discountInput}
                                    onChange={handleDiscountChange}
                                    className="w-24 text-right px-2 py-1 bg-gray-800 border border-gray-600 rounded-md text-white text-sm"
                                    placeholder="0,00"
                                />
                            </div>

                            {discount > subtotal && (
                                <p className="text-red-500 text-xs mt-1">Desconto máximo aplicado é R$ {subtotal.toFixed(2)}.</p>
                            )}


                            <div className="flex justify-between text-2xl font-extrabold pt-3">
                                <span className="text-white">Total:</span>
                                <span className="text-green-400">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Opções de Pagamento (Antes era visível se NÃO Fiado, agora é sempre visível) */}
                        <div className="space-y-3">
                            {/* Toggle de Múltiplas Formas de Pagamento */}
                            <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-700 rounded-md">
                                <span className="text-blue-400 font-medium flex items-center gap-2 text-sm">
                                    <Tag className="w-4 h-4" /> Múltiplas Formas?
                                </span>
                                <button
                                    onClick={() => handleToggleMultiplePayments(!useMultiplePayments)}
                                    className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-all duration-300 ${useMultiplePayments ? "bg-blue-600" : "bg-gray-600"
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 bg-white rounded-full transform transition-all duration-300 ${useMultiplePayments ? "translate-x-4" : "translate-x-0"
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Pagamento Único (Visível se NÃO Múltiplo) */}
                            {!useMultiplePayments && (
                                <div className="space-y-1">
                                    <label className="text-gray-400 text-sm block">Forma de Pagamento Única</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 focus:border-green-400 rounded-md px-3 py-2 text-white text-sm"
                                    >
                                        <option value="" disabled>Selecione</option>
                                        {paymentOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Pagamento Múltiplo (Visível se Múltiplo) */}
                            {useMultiplePayments && (
                                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-md space-y-3">
                                    <p className="text-blue-400 text-sm font-medium border-b border-blue-700 pb-2 flex justify-between items-center">
                                        <span>
                                            <CreditCard className="w-4 h-4 inline-block mr-1" /> Distribuir Pagamento
                                        </span>
                                        <span className={`text-xs font-semibold ${Math.abs(remainingToPay) < 0.01 ? 'text-green-400' : 'text-yellow-400'}`}>
                                            Falta: R$ {remainingToPay.toFixed(2)}
                                        </span>
                                    </p>

                                    {distributedPayments.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <select
                                                value={item.method}
                                                onChange={(e) => handleDistributedPaymentMethodChange(e, index)}
                                                className="flex-1 bg-gray-800 border border-blue-600 rounded-md px-3 py-1.5 text-white text-sm"
                                            >
                                                <option value="" disabled>Método</option>
                                                {paymentOptions.map(opt => (
                                                    <option
                                                        key={opt}
                                                        value={opt}
                                                        disabled={distributedPayments.some((p, i) => i !== index && p.method === opt && opt !== "Outro")}
                                                    >
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>

                                            <input
                                                type="text"
                                                placeholder="Valor R$"
                                                value={item.valueInput}
                                                onChange={(e) => handleDistributedPaymentValueChange(e, index)}
                                                className="w-24 text-right bg-gray-800 border border-blue-600 rounded-md px-3 py-1.5 text-white text-sm placeholder-gray-400"
                                            />
                                            <button
                                                onClick={() => handleRemoveDistributedPayment(index)}
                                                className="text-red-400 hover:text-red-300 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleAddDistributedPayment}
                                        disabled={Math.abs(remainingToPay) < 0.01 || distributedPayments.length >= paymentOptions.length}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-md transition-colors disabled:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Forma de Pagamento
                                    </button>
                                </div>
                            )}

                        </div>


                        {/* BOTÃO FINALIZAR VENDA */}
                        <button
                            onClick={handleFinishSale}
                            disabled={selectedProducts.length === 0 || isLoading || (!useMultiplePayments && !paymentMethod)} // Condição ajustada
                            className="w-full bg-green-600 hover:bg-green-500 text-white font-extrabold py-3 rounded-md transition-colors flex items-center justify-center gap-3 text-lg disabled:bg-gray-600 disabled:opacity-50"
                        >
                            {isLoading ? "Processando..." : (
                                <>
                                    <Check className="w-6 h-6" />
                                    FINALIZAR VENDA (R$ {total.toFixed(2)})
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