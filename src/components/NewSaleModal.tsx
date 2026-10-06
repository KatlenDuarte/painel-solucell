// src/components/NewSaleModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
    X, Search, Tag, Trash2, Minus, Plus,
    Wrench, PackageX, ShoppingCart,
    CreditCard, Banknote, QrCode, Layers, UserX
} from "lucide-react";

// Firebase
import { db } from "../lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "../lib/firestore";
import { addToFiado } from "../lib/saleActions";
import { formatBRL } from "../lib/format";
import { useStoreData } from "../contexts/StoreDataContext";

// --- Interfaces ---
interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    barcode?: string;
}

interface SaleItem extends Product {
    saleQty: number;
    total: number;
}

interface MultiPayment {
    pix: number;
    cartao: number;
    dinheiro: number;
    fiado: {
        valor: number;
        nome: string;
        whatsapp: string;
        data: string;
    };
}

const formatCurrencyInput = (raw: string): [number, string] => {
    let clean = raw.replace(/[^\d]/g, "");
    if (!clean) return [0, ""];
    const num = parseFloat(clean) / 100;
    const display = num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [num, display];
};

interface NewSaleModalProps {
    onClose: () => void;
    storeEmail: string | null;
    onSaleComplete: () => void;
}

const NewSaleModal: React.FC<NewSaleModalProps> = ({ onClose, storeEmail, onSaleComplete }) => {
    const [activeTab, setActiveTab] = useState<'venda' | 'manutencao' | 'perda'>('venda');
    const [isLoading, setIsLoading] = useState(false);
    const [productSearch, setProductSearch] = useState("");

    const [showPrintModal, setShowPrintModal] = useState(false);
    const [saleToPrint, setSaleToPrint] = useState<any>(null);

    // --- ESTADOS VENDA ---
    const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"PIX" | "Cartão" | "Dinheiro" | "Múltiplos" | "Fiado">("PIX");

    const [payments, setPayments] = useState<MultiPayment>({
        pix: 0,
        cartao: 0,
        dinheiro: 0,
        fiado: { valor: 0, nome: "", whatsapp: "", data: "" }
    });

    // Inputs auxiliares mascarados para a aba de Múltiplos e Fiado
    const [multiPixInput, setMultiPixInput] = useState("");
    const [multiCartaoInput, setMultiCartaoInput] = useState("");
    const [multiDinheiroInput, setMultiDinheiroInput] = useState("");
    const [fiadoValorInput, setFiadoValorInput] = useState("");

    const [nonCatalogItem, setNonCatalogItem] = useState({ name: "", price: 0 });
    const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

    // --- ESTADOS MANUTENÇÃO ---
    const [maint, setMaint] = useState({ client: "", device: "", problem: "", partCost: 0, totalService: 0 });
    const [maintPartInput, setMaintPartInput] = useState("");
    const [maintTotalInput, setMaintTotalInput] = useState("");

    // --- ESTADOS PERDA ---
    const [lossProducts, setLossProducts] = useState<SaleItem[]>([]);
    const [lossReason, setLossReason] = useState("");

    // Estoque em tempo real pelo listener compartilhado (sem reler a coleção a cada abertura)
    const { products: productDocs, sales: salesDocs } = useStoreData();

    // Fiado: cliente que já está devendo pode ter a compra somada na mesma conta
    const [joinFiado, setJoinFiado] = useState<{ id: string; nome: string; total: number } | null>(null);
    const openDebtors = useMemo(() => {
        const q = payments.fiado.nome.trim().toLowerCase();
        if (q.length < 2) return [];
        const list: { id: string; nome: string; total: number }[] = [];
        salesDocs.forEach(d => {
            const s = d.data();
            if (s.status !== "pending") return;
            const nome = String(s.fiado?.nome || s.clientName || "");
            if (nome && nome.toLowerCase().includes(q)) list.push({ id: d.id, nome, total: Number(s.total) || Number(s.fiado?.valor) || 0 });
        });
        return list.slice(0, 4);
    }, [salesDocs, payments.fiado.nome]);
    const stock = useMemo<Product[]>(
        () => productDocs.map((d) => ({ id: d.id, ...d.data() } as Product)),
        [productDocs]
    );

    // Leitor de Código de Barras
    useEffect(() => {
        let barcodeBuffer = "";
        let timeout: NodeJS.Timeout | null = null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;

            clearTimeout(timeout);

            if (e.key === "Enter") {
                const code = barcodeBuffer.trim();
                if (code.length >= 4) {
                    const product = stock.find(p => String(p.barcode).trim() === code);
                    if (product) {
                        handleAddProduct(product, activeTab === "perda" ? "perda" : "venda");
                    }
                }
                barcodeBuffer = "";
                return;
            }

            if (/^[0-9A-Za-z]$/.test(e.key)) {
                barcodeBuffer += e.key;
            }

            timeout = setTimeout(() => {
                barcodeBuffer = "";
            }, 100);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            clearTimeout(timeout);
        };
    }, [stock, activeTab]);

    const handlePrint = async () => {
        if (!saleToPrint) return;

        try {
            await fetch("http://localhost:3333/print", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    items: saleToPrint.items,
                    total: saleToPrint.total,
                    paymentMethod: saleToPrint.paymentMethod,
                    discount: saleToPrint.discount || 0,
                }),
            });
        } catch (err) {
            console.error(err);
        }

        setShowPrintModal(false);
        onSaleComplete();
        onClose();
    };


    // Cálculos Reativos
    const subtotal = useMemo(() => selectedProducts.reduce((acc, curr) => acc + curr.total, 0), [selectedProducts]);
    const totalVenda = Math.max(0, subtotal - discount);
    const totalLoss = useMemo(() => lossProducts.reduce((acc, curr) => acc + curr.total, 0), [lossProducts]);
    const filteredStock = stock.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch));

    const totalFinalCalculado = useMemo(() => {
        if (activeTab === 'venda') return totalVenda;
        if (activeTab === 'manutencao') return maint.totalService;
        return totalLoss;
    }, [activeTab, totalVenda, maint.totalService, totalLoss]);

    // Soma dos múltiplos pagamentos para validação
    const totalMultiPreenchido = useMemo(() => {
        return payments.pix + payments.cartao + payments.dinheiro;
    }, [payments.pix, payments.cartao, payments.dinheiro]);

    const handleFinish = async () => {
        console.log("SALVANDO VENDA");
        if (!storeEmail) return alert("Erro: Email da loja não identificado.");
        setIsLoading(true);

        try {
            let saleData: any = {
                store: storeEmail,
                timestamp: serverTimestamp(),
                type: activeTab,
            };

            if (paymentMethod === "Fiado" && activeTab === 'venda' && joinFiado) {
                if (selectedProducts.length === 0) throw new Error("Adicione ao menos um produto.");
                const added = await addToFiado(
                    joinFiado.id,
                    selectedProducts.map(i => ({ id: i.id.startsWith("avulso-") ? "" : i.id, name: i.name, price: i.price, saleQty: i.saleQty })),
                    discount
                );
                alert(`Somado ${formatBRL(added)} na conta de ${joinFiado.nome}. Agora deve ${formatBRL(joinFiado.total + added)}.`);
                onSaleComplete();
                onClose();
                return;
            }

            if (paymentMethod === "Fiado" && activeTab !== 'perda') {
                if (!payments.fiado.nome || payments.fiado.valor <= 0) {
                    throw new Error("Preencha o nome e o valor correto do fiado.");
                }
                saleData.status = "pending";
                saleData.paymentMethod = "Fiado";
                saleData.total = totalFinalCalculado;
                saleData.fiado = payments.fiado;
                saleData.items = activeTab === 'venda'
                    ? selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }))
                    : [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
            } else if (paymentMethod === "Múltiplos" && activeTab !== 'perda') {
                if (Math.abs(totalMultiPreenchido - totalFinalCalculado) > 0.01) {
                    throw new Error(`A soma dos valores (R$ ${totalMultiPreenchido.toFixed(2)}) deve ser exatamente igual ao total geral (R$ ${totalFinalCalculado.toFixed(2)}).`);
                }
                saleData.status = "completed";
                saleData.paymentMethod = "Múltiplos";
                saleData.multiplePayments = [];

                if (payments.pix > 0) {
                    saleData.multiplePayments.push({
                        method: "PIX",
                        value: payments.pix
                    });
                }

                if (payments.cartao > 0) {
                    saleData.multiplePayments.push({
                        method: "CARTÃO",
                        value: payments.cartao
                    });
                }

                if (payments.dinheiro > 0) {
                    saleData.multiplePayments.push({
                        method: "DINHEIRO",
                        value: payments.dinheiro
                    });
                }
                saleData.total = totalFinalCalculado;
                saleData.items = activeTab === 'venda'
                    ? selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }))
                    : [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
            } else {
                saleData.status = activeTab === 'perda' ? "loss" : "completed";
                let finalPayments = { ...payments };

                if (paymentMethod === "PIX") {
                    finalPayments = { pix: totalFinalCalculado, cartao: 0, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Cartão") {
                    finalPayments = { pix: 0, cartao: totalFinalCalculado, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Dinheiro") {
                    finalPayments = { pix: 0, cartao: 0, dinheiro: totalFinalCalculado, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                }

                saleData.payments = finalPayments;
                saleData.paymentMethod = activeTab === 'perda' ? "N/A" : paymentMethod;

                if (activeTab === 'venda') {
                    if (selectedProducts.length === 0) throw new Error("Adicione ao menos um produto.");
                    saleData.items = selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.discount = discount;
                    saleData.type = 'venda_direta';
                } else if (activeTab === 'manutencao') {
                    if (!maint.client || maint.totalService <= 0) throw new Error("Preencha os dados da manutenção.");
                    saleData.clientName = maint.client;
                    saleData.items = [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
                    saleData.total = maint.totalService;
                    saleData.partCost = maint.partCost;
                    saleData.maintenanceDetails = maint;
                    saleData.type = 'manutencao';
                } else if (activeTab === 'perda') {
                    if (lossProducts.length === 0) throw new Error("Selecione os produtos da perda.");
                    saleData.items = lossProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.lossReason = lossReason || "Não informado";
                    saleData.type = 'perda';
                }
            }

            // TRANSACTION - Baixa de estoque segura
            // TRANSACTION - Baixa de estoque segura
            await runTransaction(db, async (transaction) => {

                const itemsToUpdate =
                    activeTab === "perda"
                        ? lossProducts
                        : activeTab === "venda"
                            ? selectedProducts
                            : []; // manutenção não baixa estoque aqui

                const updates: {
                    ref: any;
                    snap: any;
                    qty: number;
                }[] = [];

                // Lê todos os produtos apenas uma vez
                for (const item of itemsToUpdate) {

                    if (item.id.startsWith("avulso-")) continue;

                    const ref = doc(db, "products", item.id);

                    const snap = await transaction.get(ref);

                    if (!snap.exists()) {
                        throw new Error(`Produto ${item.name} não encontrado.`);
                    }

                    const stock = snap.data().stock ?? 0;

                    if (stock < item.saleQty) {
                        throw new Error(
                            `Estoque insuficiente para ${item.name}.`
                        );
                    }

                    updates.push({
                        ref,
                        snap,
                        qty: item.saleQty
                    });
                }

                // Atualiza estoque
                for (const item of updates) {

                    const stock = item.snap.data().stock ?? 0;

                    transaction.update(item.ref, {
                        stock: stock - item.qty
                    });
                }

                // Salva venda
                const saleRef = doc(collection(db, "sales"));

                transaction.set(saleRef, saleData);
            });
            setSaleToPrint(saleData);
            setShowPrintModal(true);

        } catch (error: any) {
            console.error(error);
            alert(error.message || "Erro ao salvar operação.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProduct = (p: Product, target: "venda" | "perda") => {
        const setList = target === "venda" ? setSelectedProducts : setLossProducts;
        setList(prev => {
            const existing = prev.find(item => item.id === p.id);
            if (existing) {
                if (existing.saleQty >= p.stock) return prev;
                return prev.map(item => item.id === p.id ? { ...item, saleQty: item.saleQty + 1, total: item.price * (item.saleQty + 1) } : item);
            }
            return [...prev, { ...p, saleQty: 1, total: p.price }];
        });
        setProductSearch("");
    };

    const handleQtyChange = (
        id: string,
        qty: number,
        target: 'venda' | 'perda'
    ) => {
        const setList =
            target === 'venda'
                ? setSelectedProducts
                : setLossProducts;

        setList(prev =>
            prev.map(item => {
                if (item.id === id) {

                    const newQty = Math.min(
                        Math.max(1, qty),
                        item.stock
                    );

                    return {
                        ...item,
                        saleQty: newQty,
                        total: item.price * newQty
                    };
                }

                return item;
            })
        );
    };

    const handleAddNonCatalog = () => {
        if (!nonCatalogItem.name || nonCatalogItem.price <= 0) return;
        const newItem: SaleItem = {
            id: `avulso-${Date.now()}`,
            name: `(AVULSO) ${nonCatalogItem.name}`,
            price: nonCatalogItem.price,
            stock: 999, saleQty: 1, total: nonCatalogItem.price
        };
        setSelectedProducts([...selectedProducts, newItem]);
        setNonCatalogItem({ name: "", price: 0 });
        setNonCatalogPriceInput("");
    };

    const theme = {
        venda: { border: 'border-emerald-500/30', text: 'text-emerald-400', icon: <ShoppingCart size={18} /> },
        manutencao: { border: 'border-blue-500/30', text: 'text-blue-400', icon: <Wrench size={18} /> },
        perda: { border: 'border-rose-500/30', text: 'text-rose-400', icon: <PackageX size={18} /> }
    }[activeTab];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-stretch sm:items-center justify-center z-50 sm:p-4 font-sans text-slate-300">
            <div className="bg-slate-900 sm:border border-slate-800 sm:rounded-2xl w-full max-w-6xl h-full sm:h-[90vh] shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-slate-950 border ${theme.border} ${theme.text}`}>
                            {theme.icon}
                        </div>
                        <h2 className="text-sm font-semibold text-slate-50">
                            {activeTab === 'venda' ? 'Nova Venda' : activeTab === 'manutencao' ? 'Ordem de Manutenção' : 'Registro de Perda'}
                        </h2>
                    </div>

                    <div className="order-3 sm:order-none w-full sm:w-auto grid grid-cols-3 sm:flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {((['venda', 'manutencao', 'perda'] as const)).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setPaymentMethod('PIX'); }}
                                className={`px-4 py-2 sm:py-1.5 rounded-lg text-sm sm:text-xs font-medium transition-all ${activeTab === tab ? 'bg-slate-900 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                            >
                                {tab === 'venda' ? 'Venda' : tab === 'manutencao' ? 'Manutenção' : 'Perda'}
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-50 border border-transparent hover:border-slate-800 rounded-lg transition-all">
                        <X size={16} />
                    </button>
                </header>

                {/* Main Content */}
                <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

                    {/* Left Column */}
                    <section className="lg:flex-1 lg:overflow-y-auto p-4 sm:p-6 space-y-6">
                        {(activeTab === 'venda' || activeTab === 'perda') && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        placeholder="Buscar produto por nome ou código..."
                                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-slate-700 transition-all text-slate-50 placeholder-slate-500"
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                    {productSearch && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 divide-y divide-slate-900">
                                            {filteredStock.length === 0 ? (
                                                <p className="text-xs text-slate-500 p-3 text-center">Nenhum produto encontrado.</p>
                                            ) : filteredStock.map(p => (
                                                <button key={p.id} onClick={() => handleAddProduct(p, activeTab)} className="w-full p-2.5 flex justify-between items-center rounded-lg hover:bg-slate-900 text-left transition-colors">
                                                    <div>
                                                        <p className="font-medium text-slate-200 text-xs">{p.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">Disponível: {p.stock}</p>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-400">R$ {p.price.toFixed(2)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <span className="text-xs font-semibold text-slate-500 block px-1">Itens da Lista</span>
                                    {(activeTab === 'venda' ? selectedProducts : lossProducts).length === 0 ? (
                                        <div className="border border-dashed border-slate-800 p-8 rounded-xl text-center text-xs text-slate-500">
                                            Nenhum item selecionado. Use o campo de busca acima.
                                        </div>
                                    ) : (activeTab === 'venda' ? selectedProducts : lossProducts).map(item => (
                                        <div key={item.id} className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between hover:border-slate-800 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                                                    <Tag size={14} />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-200 text-xs">{item.name}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">R$ {item.price.toFixed(2)} un.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                                                    <button onClick={() => handleQtyChange(item.id, item.saleQty - 1, activeTab)} className="p-1 hover:text-slate-50 text-slate-500 transition-colors"><Minus size={12} /></button>
                                                    <span className="px-2 font-mono text-slate-50 text-xs">{item.saleQty}</span>
                                                    <button onClick={() => handleQtyChange(item.id, item.saleQty + 1, activeTab)} className="p-1 hover:text-slate-50 text-slate-500 transition-colors"><Plus size={12} /></button>
                                                </div>
                                                <button onClick={() => activeTab === 'venda' ? setSelectedProducts(prev => prev.filter(p => p.id !== item.id)) : setLossProducts(prev => prev.filter(p => p.id !== item.id))} className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {activeTab === 'venda' && (
                                    <div className="bg-slate-950/30 border border-slate-800/80 p-4 rounded-xl flex items-end gap-3">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-xs font-medium text-slate-500">Item Avulso (Fora do Catálogo)</label>
                                            <input className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs outline-none text-slate-50 placeholder-slate-600 focus:border-slate-700" placeholder="Descrição rápida da mercadoria/serviço" value={nonCatalogItem.name} onChange={e => setNonCatalogItem({ ...nonCatalogItem, name: e.target.value })} />
                                        </div>
                                        <div className="w-28 space-y-1.5">
                                            <label className="text-xs font-medium text-slate-500">Preço</label>
                                            <input className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs font-mono text-right outline-none text-slate-50 focus:border-slate-700" value={nonCatalogPriceInput} placeholder="R$ 0,00" onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setNonCatalogPriceInput(s); setNonCatalogItem({ ...nonCatalogItem, price: v }); }} />
                                        </div>
                                        <button onClick={handleAddNonCatalog} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-50 p-2.5 rounded-lg transition-all"><Plus size={16} /></button>
                                    </div>
                                )}

                                {activeTab === 'perda' && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500 ml-1">Justificativa da Baixa / Perda</label>
                                        <textarea className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs h-20 outline-none text-slate-50 placeholder-slate-600 focus:border-slate-700 resize-none" placeholder="Informe o motivo detalhado..." value={lossReason} onChange={e => setLossReason(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'manutencao' && (
                            <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-xl space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Nome do Cliente</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-50 outline-none focus:border-slate-700" placeholder="Ex: João Silva da Costa" value={maint.client} onChange={e => setMaint({ ...maint, client: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Aparelho / Dispositivo</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-50 outline-none focus:border-slate-700" placeholder="Ex: iPhone 13 Pro Max" value={maint.device} onChange={e => setMaint({ ...maint, device: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">Laudo Técnico / Serviço Realizado</label>
                                    <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-50 outline-none focus:border-slate-700" placeholder="Ex: Troca de tela" value={maint.problem} onChange={e => setMaint({ ...maint, problem: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-rose-500">Custo da Peça (Bancada)</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-50 outline-none focus:border-slate-700" placeholder="R$ 0,00" value={maintPartInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMaintPartInput(s); setMaint({ ...maint, partCost: v }); }} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-emerald-500">Valor Cobrado do Cliente</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-50 outline-none focus:border-slate-700" placeholder="R$ 0,00" value={maintTotalInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMaintTotalInput(s); setMaint({ ...maint, totalService: v }); }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Right Column - Summary & Checkout */}
                    <aside className="w-full lg:w-[380px] bg-slate-950/40 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-6 justify-between lg:overflow-y-auto">
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Subtotal</span>
                                    <span className="font-mono">R$ {(activeTab === 'venda' ? subtotal : activeTab === 'manutencao' ? maint.totalService : totalLoss).toFixed(2)}</span>
                                </div>
                                {activeTab === 'venda' && (
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <span>Desconto</span>
                                        <input
                                            className="w-20 bg-slate-950 border border-slate-800 p-1 rounded font-mono text-right text-rose-400 text-xs focus:border-slate-700 outline-none"
                                            placeholder="R$ 0,00"
                                            value={discountInput}
                                            onChange={e => {
                                                const [v, s] = formatCurrencyInput(e.target.value);
                                                setDiscountInput(s);
                                                setDiscount(v);
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="h-px bg-slate-800/60 my-1" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-slate-50">Total Geral</span>
                                    <span className="text-lg font-bold font-mono text-emerald-400">R$ {totalFinalCalculado.toFixed(2)}</span>
                                </div>
                            </div>

                            {activeTab !== 'perda' && (
                                <div className="space-y-4">
                                    <span className="text-xs font-semibold text-slate-500 block px-1">Método de Pagamento</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {((['PIX', 'Cartão', 'Dinheiro', 'Múltiplos', 'Fiado'] as const)).map(method => (
                                            <button
                                                key={method}
                                                onClick={() => setPaymentMethod(method)}
                                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === method ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-50'}`}
                                            >
                                                {method === 'PIX' && <QrCode size={14} />}
                                                {method === 'Cartão' && <CreditCard size={14} />}
                                                {method === 'Dinheiro' && <Banknote size={14} />}
                                                {method === 'Múltiplos' && <Layers size={14} />}
                                                {method === 'Fiado' && <UserX size={14} />}
                                                <span className="text-xs font-medium font-sans">{method}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Sub-interface para Múltiplos Formas de Pagamento */}
                                    {paymentMethod === "Múltiplos" && (
                                        <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl space-y-3.5">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><QrCode size={12} /> PIX</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-slate-50 outline-none" placeholder="R$ 0,00" value={multiPixInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiPixInput(s); setPayments(p => ({ ...p, pix: v })); }} />
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><CreditCard size={12} /> Cartão</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-slate-50 outline-none" placeholder="R$ 0,00" value={multiCartaoInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiCartaoInput(s); setPayments(p => ({ ...p, cartao: v })); }} />
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><Banknote size={12} /> Dinheiro</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-slate-50 outline-none" placeholder="R$ 0,00" value={multiDinheiroInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiDinheiroInput(s); setPayments(p => ({ ...p, dinheiro: v })); }} />
                                            </div>
                                            <div className="h-px bg-slate-800/50" />
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500">Total Informado:</span>
                                                <span className={`font-mono font-bold ${Math.abs(totalMultiPreenchido - totalFinalCalculado) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {totalMultiPreenchido.toFixed(2)} / R$ {totalFinalCalculado.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-interface para Fiado */}
                                    {paymentMethod === "Fiado" && (
                                        <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl space-y-2.5">
                                            <input className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-50 outline-none" placeholder="Nome do Devedor" value={payments.fiado.nome} onChange={e => { setJoinFiado(null); setPayments(p => ({ ...p, fiado: { ...p.fiado, nome: e.target.value } })); }} />
                                            {activeTab === 'venda' && joinFiado && (
                                                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                                                    <span>Vai somar na conta de <b>{joinFiado.nome}</b> (deve {formatBRL(joinFiado.total)} → {formatBRL(joinFiado.total + totalFinalCalculado)})</span>
                                                    <button type="button" onClick={() => setJoinFiado(null)} className="shrink-0 underline">Abrir fiado novo</button>
                                                </div>
                                            )}
                                            {activeTab === 'venda' && !joinFiado && openDebtors.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-[11px] text-slate-400">Já está devendo? Some na mesma conta:</p>
                                                    {openDebtors.map(d => (
                                                        <button key={d.id} type="button" onClick={() => setJoinFiado(d)}
                                                            className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs text-slate-200 hover:border-emerald-600">
                                                            <span className="truncate">Somar na conta de <b>{d.nome}</b></span>
                                                            <span className="shrink-0 font-mono">deve {formatBRL(d.total)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <input className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-50 outline-none" placeholder="WhatsApp (Opcional)" value={payments.fiado.whatsapp} onChange={e => setPayments(p => ({ ...p, fiado: { ...p.fiado, whatsapp: e.target.value } }))} />
                                            <div className="flex gap-2">
                                                <input type="date" className="flex-1 bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-300 outline-none" value={payments.fiado.data} onChange={e => setPayments(p => ({ ...p, fiado: { ...p.fiado, data: e.target.value } }))} />
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-2 rounded font-mono text-right text-xs text-slate-50 outline-none" placeholder="R$ 0,00" value={fiadoValorInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setFiadoValorInput(s); setPayments(p => ({ ...p, fiado: { ...p.fiado, valor: v } })); }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleFinish}
                            disabled={isLoading || totalFinalCalculado <= 0}
                            className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-xl text-xs transition-all shadow-lg"
                        >
                            {isLoading ? "Processando..." : "Concluir Lançamento"}
                        </button>

                        {showPrintModal && (
                            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
                                <div className="bg-slate-900 border border-slate-700 rounded-xl w-[400px] p-6">

                                    <h2 className="text-xl font-bold text-slate-50 mb-2">
                                        Venda concluída
                                    </h2>

                                    <p className="text-slate-300 mb-6">
                                        Deseja imprimir o cupom?
                                    </p>

                                    <div className="flex justify-end gap-3">

                                        <button
                                            onClick={() => {
                                                setShowPrintModal(false);
                                                onSaleComplete();
                                                onClose();
                                            }}
                                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50"
                                        >
                                            Não
                                        </button>

                                        <button
                                            onClick={handlePrint}
                                            className="px-4 py-2 rounded-lg bg-primary text-white"
                                        >
                                            Imprimir
                                        </button>

                                    </div>

                                </div>
                            </div>
                        )}
                    </aside>

                </main>
            </div>
        </div>
    );
};

export default NewSaleModal;