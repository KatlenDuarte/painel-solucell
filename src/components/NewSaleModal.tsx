import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  X,
  Search,
  CreditCard,
  Tag,
  Check,
  Trash2,
  Minus,
  PlusCircle,
  Package,
  ReceiptText,
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
  expectedPaymentDate?: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
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

const formatCurrencyInput = (raw: string): [number, string] => {
  const clean = raw.replace(/[^\d]/g, "");
  if (!clean) return [0, ""];

  const num = parseFloat(clean) / 100;

  const display = num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return [num, display];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const paymentOptions = ["PIX", "Cartão", "Dinheiro", "Outro"];

const NewSaleModal: React.FC<NewSaleModalProps> = ({
  onClose,
  storeEmail,
  onSaleComplete,
}) => {
  const [stock, setStock] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFiado, setIsFiado] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");

  const [productSearch, setProductSearch] = useState("");

  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("");
  const [useMultiplePayments, setUseMultiplePayments] = useState(false);
  const [distributedPayments, setDistributedPayments] = useState<
    DistributedPayment[]
  >([]);

  const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);

  const [nonCatalogItem, setNonCatalogItem] = useState({
    name: "",
    price: 0,
  });

  const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

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
          price: Number(p.price || 0),
          stock: Number(p.stock ?? 0),
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

  const total = useMemo(
    () => Math.max(0, subtotal - discountValid),
    [subtotal, discountValid]
  );

  const distributedSum = useMemo(
    () => distributedPayments.reduce((sum, p) => sum + p.value, 0),
    [distributedPayments]
  );

  const remainingToPay = total - distributedSum;

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [num, display] = formatCurrencyInput(e.target.value);
    setDiscount(num);
    setDiscountInput(display);
  };

  const handleNonCatalogPriceChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const [num, display] = formatCurrencyInput(e.target.value);
    setNonCatalogPriceInput(display);
    setNonCatalogItem((prev) => ({ ...prev, price: num }));
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
      stock: 999999,
      saleQty: 1,
      total: nonCatalogItem.price,
    };

    setSelectedProducts((prev) => [...prev, newItem]);
    setNonCatalogItem({ name: "", price: 0 });
    setNonCatalogPriceInput("");
  };

  const handleQtyChange = (id: string, qty: number) => {
    const isNonCatalog = id.startsWith("non-catalog-");
    const stockItem = stock.find((s) => s.id === id);

    const maxStock = isNonCatalog ? 999999 : stockItem ? stockItem.stock : 1;
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

  const handleToggleFiado = () => {
    const next = !isFiado;

    setIsFiado(next);

    if (next) {
      setUseMultiplePayments(false);
      setPaymentMethod("");
      setDistributedPayments([]);
    }
  };

  const handleToggleMultiplePayments = (value: boolean) => {
    setUseMultiplePayments(value);
    setIsFiado(false);
    setPaymentMethod("");
    setDistributedPayments([]);

    if (value) {
      setClientName("");
      setClientPhone("");
      setExpectedPaymentDate("");
    }
  };

  const handleAddDistributedPayment = () => {
    if (distributedPayments.length >= paymentOptions.length) return;

    const availableMethod =
      paymentOptions.find(
        (opt) =>
          opt !== "Outro" &&
          !distributedPayments.some((p) => p.method === opt)
      ) || "Outro";

    const initialValue = remainingToPay > 0 ? remainingToPay : 0;

    const initialValueDisplay =
      initialValue > 0
        ? formatCurrencyInput(String(Math.round(initialValue * 100)))[1]
        : "";

    setDistributedPayments((prev) => [
      ...prev,
      {
        method: availableMethod,
        value: initialValue,
        valueInput: initialValueDisplay,
      },
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

    const isMethodTaken = distributedPayments.some(
      (p, i) => i !== index && p.method === newMethod && newMethod !== "Outro"
    );

    if (isMethodTaken) {
      alert(`O método de pagamento "${newMethod}" já foi selecionado.`);
      return;
    }

    setDistributedPayments((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, method: newMethod } : item
      )
    );
  };

  const handleDistributedPaymentValueChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const [num, display] = formatCurrencyInput(e.target.value);

    setDistributedPayments((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, value: num, valueInput: display } : item
      )
    );
  };

  const handleFinishSale = async () => {
    if (selectedProducts.length === 0) {
      alert("Adicione pelo menos um item.");
      return;
    }

    if (isFiado) {
      if (!clientName.trim() || !clientPhone.trim()) {
        alert("Preencha nome e telefone do cliente para vendas fiadas.");
        return;
      }

      if (!expectedPaymentDate.trim()) {
        alert("Preencha a data prevista de pagamento.");
        return;
      }
    }

    if (!isFiado) {
      if (useMultiplePayments) {
        if (distributedPayments.length === 0) {
          alert("Adicione pelo menos uma forma de pagamento distribuída.");
          return;
        }

        if (Math.abs(remainingToPay) > 0.01) {
          alert(
            `O total dos pagamentos (${formatCurrency(
              distributedSum
            )}) não corresponde ao total da venda (${formatCurrency(
              total
            )}). Falta ${formatCurrency(remainingToPay)}.`
          );
          return;
        }
      } else if (!paymentMethod) {
        alert("Selecione a forma de pagamento.");
        return;
      }
    }

    if (!storeEmail) {
      alert("Erro de autenticação: Email da loja não encontrado.");
      return;
    }

    setIsLoading(true);

    try {
      const finalPayments = isFiado
        ? []
        : useMultiplePayments
          ? distributedPayments.map((p) => ({
            method: p.method,
            value: p.value,
          }))
          : paymentMethod
            ? [{ method: paymentMethod, value: total }]
            : [];

      const saleData = {
        store: storeEmail,
        clientName: isFiado ? clientName.trim() : "",
        clientPhone: isFiado ? clientPhone.trim() : "",
        isFiado,
        expectedPaymentDate: isFiado ? expectedPaymentDate : "",
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

      await registerSaleAndAdjustStock(saleData);

      alert(
        isFiado
          ? `Venda fiada registrada com sucesso! Total: ${formatCurrency(total)}`
          : `Venda registrada com sucesso! Total: ${formatCurrency(total)}`
      );

      onSaleComplete();
      onClose();
    } catch (err) {
      console.error("Erro ao finalizar venda", err);
      alert("Erro ao finalizar venda. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && selectedProducts.length === 0 && stock.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-slate-300 text-sm font-black uppercase tracking-widest">
          Carregando produtos...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5">
      <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl relative overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Nova operação
            </span>

            <h2 className="text-lg sm:text-xl font-black text-white mt-2">
              Registrar Venda<span className="text-emerald-500">.</span>
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Adicione produtos, defina pagamento e finalize a venda.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-4">
              <SectionTitle
                title="Itens da venda"
                description="Busque produtos cadastrados ou adicione um item avulso."
              />

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />

                <input
                  type="text"
                  placeholder="Buscar produto cadastrado..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-11 pr-4 py-3 w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl text-white placeholder-slate-600 transition-colors text-sm outline-none"
                />

                {productSearch && (
                  <div className="absolute top-full mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleAddProduct(p)}
                          disabled={p.stock === 0}
                          className={`w-full px-4 py-3 text-left border-b border-slate-800 last:border-none transition-colors flex justify-between items-center text-sm ${p.stock === 0
                              ? "bg-red-500/10 text-red-400 opacity-70 cursor-not-allowed"
                              : "hover:bg-slate-900 text-slate-200"
                            }`}
                        >
                          <span className="truncate pr-3">
                            {p.name}
                            <span
                              className={`text-[11px] ml-2 ${p.stock === 0
                                  ? "text-red-400"
                                  : "text-slate-500"
                                }`}
                            >
                              {p.stock === 0
                                ? "(sem estoque)"
                                : `(${p.stock} em estoque)`}
                            </span>
                          </span>

                          <span className="text-emerald-400 font-black shrink-0">
                            {formatCurrency(p.price)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="p-4 text-slate-500 text-center text-sm">
                        Nenhum produto encontrado.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                <p className="text-amber-400 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Item avulso
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                  <input
                    type="text"
                    placeholder="Nome do item ou serviço"
                    value={nonCatalogItem.name}
                    onChange={(e) =>
                      setNonCatalogItem((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 outline-none focus:border-amber-500"
                  />

                  <input
                    type="text"
                    placeholder="Preço"
                    value={nonCatalogPriceInput}
                    onChange={handleNonCatalogPriceChange}
                    className="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 outline-none focus:border-amber-500"
                  />

                  <button
                    onClick={handleAddNonCatalogItem}
                    disabled={
                      !nonCatalogItem.name.trim() || nonCatalogItem.price <= 0
                    }
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 rounded-xl disabled:bg-slate-700 disabled:text-slate-400 disabled:opacity-60 transition-colors flex items-center justify-center"
                    title="Adicionar item avulso"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {selectedProducts.length === 0 ? (
                  <div className="text-center p-8 bg-slate-900/40 border border-slate-800 rounded-2xl">
                    <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm font-medium">
                      Adicione itens para começar a venda.
                    </p>
                  </div>
                ) : (
                  selectedProducts.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">
                          {item.name}
                          {item.id.startsWith("non-catalog-") && (
                            <span className="text-[10px] ml-2 text-amber-400 font-black uppercase">
                              Avulso
                            </span>
                          )}
                        </p>

                        <p className="text-slate-500 text-xs">
                          {formatCurrency(item.price)} / un.
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-2 bg-slate-950 rounded-full p-1 border border-slate-800">
                          <button
                            onClick={() =>
                              handleQtyChange(item.id, item.saleQty - 1)
                            }
                            disabled={item.saleQty <= 1}
                            className="text-slate-500 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-slate-800"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <span className="w-6 text-center text-white text-sm font-black">
                            {item.saleQty}
                          </span>

                          <button
                            onClick={() =>
                              handleQtyChange(item.id, item.saleQty + 1)
                            }
                            disabled={
                              !item.id.startsWith("non-catalog-") &&
                              item.saleQty >= item.stock
                            }
                            className="text-slate-500 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-slate-800"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-emerald-400 font-black w-24 text-right text-sm">
                          {formatCurrency(item.total)}
                        </p>

                        <button
                          onClick={() => handleRemoveProduct(item.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 h-fit">
              <SectionTitle
                title="Resumo da venda"
                description="Confira valores, desconto e pagamento."
              />

              <div className="space-y-3 border-b border-slate-800 pb-4">
                <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />

                <div className="flex justify-between items-center gap-3">
                  <label className="text-slate-500 flex items-center gap-2 text-xs font-black uppercase">
                    <Tag className="w-4 h-4" />
                    Desconto
                  </label>

                  <input
                    type="text"
                    value={discountInput}
                    onChange={handleDiscountChange}
                    className="w-28 text-right px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-emerald-500"
                    placeholder="0,00"
                  />
                </div>

                {discount > subtotal && (
                  <p className="text-red-400 text-xs">
                    Desconto máximo aplicado é {formatCurrency(subtotal)}.
                  </p>
                )}

                <div className="flex justify-between text-2xl font-black pt-3">
                  <span className="text-white">Total</span>
                  <span className={isFiado ? "text-rose-400" : "text-emerald-400"}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  <div>
                    <span className="text-rose-300 font-black flex items-center gap-2 text-xs uppercase">
                      <ReceiptText className="w-4 h-4" />
                      Venda fiada
                    </span>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Registrar como conta a receber
                    </p>
                  </div>

                  <button
                    onClick={handleToggleFiado}
                    className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-all duration-300 ${isFiado ? "bg-rose-500" : "bg-slate-700"
                      }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transform transition-all duration-300 ${isFiado ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                {isFiado && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3">
                    <div>
                      <label className="text-slate-400 text-[10px] font-black uppercase">
                        Nome do cliente
                      </label>

                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ex: João Silva"
                        className="mt-1 w-full bg-slate-900 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-slate-600"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] font-black uppercase">
                        Telefone / WhatsApp
                      </label>

                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ex: 31999999999"
                        className="mt-1 w-full bg-slate-900 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-slate-600"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] font-black uppercase">
                        Data prevista para pagamento
                      </label>

                      <input
                        type="date"
                        value={expectedPaymentDate}
                        onChange={(e) => setExpectedPaymentDate(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                )}

                {!isFiado && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                      <span className="text-blue-400 font-black flex items-center gap-2 text-xs uppercase">
                        <CreditCard className="w-4 h-4" />
                        Pagamento múltiplo
                      </span>

                      <button
                        onClick={() =>
                          handleToggleMultiplePayments(!useMultiplePayments)
                        }
                        className={`w-10 h-6 rounded-full p-0.5 flex items-center transition-all duration-300 ${useMultiplePayments ? "bg-blue-500" : "bg-slate-700"
                          }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transform transition-all duration-300 ${useMultiplePayments
                              ? "translate-x-4"
                              : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    {!useMultiplePayments && (
                      <div className="space-y-2">
                        <label className="text-slate-500 text-xs font-black uppercase">
                          Forma de pagamento
                        </label>

                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-3 text-white text-sm outline-none"
                        >
                          <option value="" disabled>
                            Selecione
                          </option>

                          {paymentOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {useMultiplePayments && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center border-b border-blue-500/20 pb-2">
                          <span className="text-blue-400 text-xs font-black uppercase flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Distribuir pagamento
                          </span>

                          <span
                            className={`text-xs font-black ${Math.abs(remainingToPay) < 0.01
                                ? "text-emerald-400"
                                : "text-amber-400"
                              }`}
                          >
                            Falta: {formatCurrency(remainingToPay)}
                          </span>
                        </div>

                        {distributedPayments.map((item, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[1fr_110px_auto] gap-2 items-center"
                          >
                            <select
                              value={item.method}
                              onChange={(e) =>
                                handleDistributedPaymentMethodChange(e, index)
                              }
                              className="bg-slate-900 border border-blue-500/30 rounded-xl px-3 py-2 text-white text-sm outline-none"
                            >
                              <option value="" disabled>
                                Método
                              </option>

                              {paymentOptions.map((opt) => (
                                <option
                                  key={opt}
                                  value={opt}
                                  disabled={distributedPayments.some(
                                    (p, i) =>
                                      i !== index &&
                                      p.method === opt &&
                                      opt !== "Outro"
                                  )}
                                >
                                  {opt}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Valor"
                              value={item.valueInput}
                              onChange={(e) =>
                                handleDistributedPaymentValueChange(e, index)
                              }
                              className="text-right bg-slate-900 border border-blue-500/30 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 outline-none"
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
                          disabled={
                            Math.abs(remainingToPay) < 0.01 ||
                            distributedPayments.length >= paymentOptions.length
                          }
                          className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-black py-2.5 rounded-xl transition-colors disabled:bg-slate-700 disabled:text-slate-400 disabled:opacity-60 flex items-center justify-center gap-2 text-xs uppercase"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar forma
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={handleFinishSale}
                disabled={
                  selectedProducts.length === 0 ||
                  isLoading ||
                  (!isFiado && !useMultiplePayments && !paymentMethod)
                }
                className={`w-full font-black py-3 rounded-xl transition-all flex items-center justify-center gap-3 text-sm disabled:bg-slate-700 disabled:text-slate-400 disabled:opacity-60 uppercase ${isFiado
                    ? "bg-rose-500 hover:bg-rose-400 text-white"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  }`}
              >
                {isLoading ? (
                  "Processando..."
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {isFiado
                      ? `Registrar fiado (${formatCurrency(total)})`
                      : `Finalizar venda (${formatCurrency(total)})`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-white">
        {title}
      </h3>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-500 text-sm">
      <span>{label}</span>
      <span className="text-slate-300 font-bold">{value}</span>
    </div>
  );
}

export default NewSaleModal;