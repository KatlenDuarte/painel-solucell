// components/EditSaleModal.tsx
// Editar venda: incluir/remover produtos, mudar quantidades, desconto e forma de pagamento.
// Ao salvar, o estoque é acertado pela diferença e os totais da venda são recalculados.

import { useEffect, useMemo, useState } from "react";
import { X, Search, Plus, Minus, Trash2, Loader2, PackagePlus, Tag, Smartphone, CreditCard, DollarSign, Layers3 } from "lucide-react";
import { doc, getDoc } from "../lib/firestore";
import { db } from "../lib/firebase";
import { useStoreData } from "../contexts/StoreDataContext";
import { updateSaleItems, type EditedItem } from "../lib/saleActions";
import { formatBRL } from "../lib/format";

interface SaleRef { id: string }

interface EditSaleModalProps {
    sale: SaleRef | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

type Line = EditedItem & { key: string };
type Pay = { method: string; value: number };

const METHODS = [
    { id: "PIX", label: "PIX", icon: Smartphone },
    { id: "Cartão", label: "Cartão", icon: CreditCard },
    { id: "Dinheiro", label: "Dinheiro", icon: DollarSign },
    { id: "Múltiplos", label: "Múltiplos", icon: Layers3 },
];

const toNumber = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
const normMethod = (m: string) => {
    const u = (m || "").toUpperCase();
    if (u === "PIX") return "PIX";
    if (u.startsWith("CART")) return "Cartão";
    if (u === "DINHEIRO") return "Dinheiro";
    if (u.startsWith("MÚLTIPLO") || u.startsWith("MULTIPLO")) return "Múltiplos";
    return m;
};
const isStockItem = (id?: string) => !!id && !id.startsWith("avulso-") && !id.startsWith("non-catalog-");

export default function EditSaleModal({ sale, isOpen, onClose, onSave }: EditSaleModalProps) {
    const { products } = useStoreData();
    const [loadedId, setLoadedId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [lines, setLines] = useState<Line[]>([]);
    const [original, setOriginal] = useState<Map<string, number>>(new Map());
    const [discount, setDiscount] = useState("");
    const [status, setStatus] = useState("");
    const [isLoss, setIsLoss] = useState(false);
    const [method, setMethod] = useState("PIX");
    const [multi, setMulti] = useState<Pay[]>([]);
    const [search, setSearch] = useState("");
    const [avulsoName, setAvulsoName] = useState("");
    const [avulsoPrice, setAvulsoPrice] = useState("");

    const loading = !!sale && loadedId !== sale.id;

    // Carrega a venda completa do banco (itens atuais = referência para o estoque)
    useEffect(() => {
        if (!isOpen || !sale) return;
        let alive = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "sales", sale.id));
                if (!snap.exists()) throw new Error("Venda não encontrada.");
                const s = snap.data() as Record<string, any>;
                if (!alive) return;
                const items: Line[] = (Array.isArray(s.items) ? s.items : []).map((it: any, i: number) => ({
                    key: `${it.id || "item"}-${i}`,
                    id: it.id ? String(it.id) : "",
                    name: String(it.name || "Item"),
                    price: Number(it.price) || 0,
                    saleQty: Number(it.saleQty ?? it.quantity ?? it.qty ?? 1) || 1,
                }));
                const orig = new Map<string, number>();
                items.forEach(i => { if (isStockItem(i.id)) orig.set(i.id!, (orig.get(i.id!) || 0) + i.saleQty); });
                setLines(items);
                setOriginal(orig);
                setDiscount(Number(s.discount) ? Number(s.discount).toFixed(2).replace(".", ",") : "");
                setStatus(String(s.status || ""));
                setIsLoss(s.status === "loss" || s.type === "perda");
                const mp = Array.isArray(s.multiplePayments) ? s.multiplePayments.filter((p: any) => p && p.method) : [];
                setMethod(mp.length ? "Múltiplos" : normMethod(String(s.paymentMethod || "PIX")));
                setMulti(mp.length ? mp.map((p: any) => ({ method: normMethod(String(p.method)), value: Number(p.value) || 0 })) : [{ method: "PIX", value: 0 }, { method: "Dinheiro", value: 0 }]);
                setError("");
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : "Erro ao carregar a venda.");
            } finally {
                if (alive) setLoadedId(sale.id);
            }
        })();
        return () => { alive = false; };
    }, [isOpen, sale]);

    const catalog = useMemo(() => products.map(d => {
        const p = d.data();
        return { id: d.id, name: String(p.name || "Produto"), price: Number(p.price) || 0, stock: Number(p.stock) || 0, barcode: String(p.barcode || "") };
    }), [products]);
    const stockById = useMemo(() => new Map(catalog.map(p => [p.id, p.stock])), [catalog]);

    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return catalog.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))).slice(0, 8);
    }, [catalog, search]);

    // Quanto dá para ter deste produto na venda: estoque atual + o que já estava na venda
    const available = (id: string) => (stockById.get(id) || 0) + (original.get(id) || 0);
    const qtyInLines = (id: string) => lines.filter(l => l.id === id).reduce((s, l) => s + l.saleQty, 0);

    const addProduct = (p: typeof catalog[number]) => {
        setError("");
        if (qtyInLines(p.id) + 1 > available(p.id)) { setError(`Sem estoque suficiente de ${p.name}.`); return; }
        setLines(ls => {
            const ex = ls.find(l => l.id === p.id);
            if (ex) return ls.map(l => l === ex ? { ...l, saleQty: l.saleQty + 1 } : l);
            return [...ls, { key: `${p.id}-${Date.now()}`, id: p.id, name: p.name, price: p.price, saleQty: 1 }];
        });
        setSearch("");
    };

    const addAvulso = () => {
        const price = toNumber(avulsoPrice);
        if (!avulsoName.trim() || price <= 0) { setError("Informe a descrição e o valor do item avulso."); return; }
        setError("");
        setLines(ls => [...ls, { key: `av-${Date.now()}`, id: "", name: avulsoName.trim(), price, saleQty: 1 }]);
        setAvulsoName(""); setAvulsoPrice("");
    };

    const changeQty = (l: Line, delta: number) => {
        setError("");
        if (delta > 0 && isStockItem(l.id) && qtyInLines(l.id!) + delta > available(l.id!)) { setError(`Sem estoque suficiente de ${l.name}.`); return; }
        setLines(ls => ls.map(x => x.key === l.key ? { ...x, saleQty: Math.max(1, x.saleQty + delta) } : x));
    };

    const changePrice = (key: string, value: string) =>
        setLines(ls => ls.map(l => l.key === key ? { ...l, price: toNumber(value) } : l));

    const gross = lines.reduce((s, l) => s + l.price * l.saleQty, 0);
    const disc = Math.min(toNumber(discount), gross);
    const total = Math.round((gross - disc) * 100) / 100;
    const multiSum = multi.reduce((s, p) => s + (Number(p.value) || 0), 0);
    const showPayment = !isLoss && status !== "pending";
    const multiError = showPayment && method === "Múltiplos" && Math.abs(multiSum - total) > 0.009;

    // O que acontece com o estoque ao salvar
    const stockChanges = useMemo(() => {
        const after = new Map<string, number>();
        lines.forEach(l => { if (isStockItem(l.id)) after.set(l.id!, (after.get(l.id!) || 0) + l.saleQty); });
        const out: { name: string; d: number }[] = [];
        for (const id of new Set([...original.keys(), ...after.keys()])) {
            const d = (after.get(id) || 0) - (original.get(id) || 0);
            if (d) out.push({ name: catalog.find(p => p.id === id)?.name || lines.find(l => l.id === id)?.name || "Produto", d });
        }
        return out;
    }, [lines, original, catalog]);

    const save = async () => {
        if (!sale) return;
        setSaving(true); setError("");
        try {
            await updateSaleItems(
                sale.id,
                lines.map(({ id, name, price, saleQty }) => ({ id, name, price, saleQty })),
                disc,
                showPayment ? { paymentMethod: method, multiplePayments: method === "Múltiplos" ? multi : undefined } : undefined
            );
            setLoadedId(null);
            onSave();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível salvar.");
        } finally {
            setSaving(false);
        }
    };

    const close = () => { if (!saving) { setLoadedId(null); onClose(); } };

    if (!isOpen || !sale) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={close}>
            <div role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-w-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-fg">Editar venda</h3>
                        <p className="mt-0.5 text-sm text-fg-subtle">
                            {isLoss ? "Registro de perda" : status === "pending" ? "Fiado em aberto: o novo total vira o valor da dívida" : "Inclua ou remova produtos; o estoque é acertado ao salvar"}
                        </p>
                    </div>
                    <button onClick={close} disabled={saving} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-subtle hover:bg-hover hover:text-fg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-fg-faint" /></div>
                ) : (
                    <div className="flex-1 space-y-5 overflow-y-auto p-5">
                        {/* Itens */}
                        <div>
                            <p className="ui-label">Itens da venda</p>
                            {lines.length ? (
                                <ul className="divide-y divide-line rounded-xl border border-line">
                                    {lines.map(l => (
                                        <li key={l.key} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                                            {isStockItem(l.id) ? <PackagePlus size={15} className="shrink-0 text-fg-faint" /> : <Tag size={15} className="shrink-0 text-fg-faint" />}
                                            <span className="min-w-0 flex-1 truncate text-fg">{l.name}</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => changeQty(l, -1)} aria-label={`Diminuir ${l.name}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line hover:bg-hover"><Minus size={13} /></button>
                                                <span className="w-6 text-center tabular text-fg">{l.saleQty}</span>
                                                <button onClick={() => changeQty(l, 1)} aria-label={`Aumentar ${l.name}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line hover:bg-hover"><Plus size={13} /></button>
                                            </div>
                                            <input defaultValue={l.price.toFixed(2).replace(".", ",")} onBlur={e => changePrice(l.key, e.target.value)}
                                                inputMode="decimal" aria-label={`Preço de ${l.name}`} className="ui-input h-8 w-24 text-right tabular" />
                                            <span className="w-24 text-right font-medium text-fg tabular">{formatBRL(l.price * l.saleQty)}</span>
                                            <button onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label={`Remover ${l.name}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-subtle hover:bg-danger-soft hover:text-danger"><Trash2 size={14} /></button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-fg-subtle">Nenhum item. Inclua um produto abaixo ou use Estornar para desfazer a venda.</p>
                            )}
                        </div>

                        {/* Incluir */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="ui-label">Incluir produto do estoque</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou código"
                                        onKeyDown={e => { if (e.key === "Enter" && results[0]) addProduct(results[0]); }}
                                        className="ui-input pl-9" aria-label="Buscar produto para incluir" />
                                </div>
                                {results.length > 0 && (
                                    <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                                        {results.map(p => (
                                            <li key={p.id}>
                                                <button onClick={() => addProduct(p)} disabled={available(p.id) - qtyInLines(p.id) <= 0}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover disabled:opacity-50">
                                                    <span className="min-w-0 flex-1 truncate text-fg">{p.name}</span>
                                                    <span className="text-xs text-fg-subtle">{p.stock} un</span>
                                                    <span className="font-medium text-fg tabular">{formatBRL(p.price)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <label className="ui-label">Incluir item avulso</label>
                                <div className="flex gap-2">
                                    <input value={avulsoName} onChange={e => setAvulsoName(e.target.value)} placeholder="Descrição" className="ui-input min-w-0 flex-1" aria-label="Descrição do item avulso" />
                                    <input value={avulsoPrice} onChange={e => setAvulsoPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" placeholder="R$" className="ui-input w-20" aria-label="Valor do item avulso" />
                                    <button onClick={addAvulso} aria-label="Incluir avulso" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-hover"><Plus size={16} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Pagamento */}
                        {showPayment && (
                            <div>
                                <p className="ui-label">Forma de pagamento</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {METHODS.map(m => (
                                        <button key={m.id} onClick={() => setMethod(m.id)}
                                            className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium ${method === m.id ? "border-primary/50 bg-primary-soft text-primary-text" : "border-line text-fg-muted hover:bg-hover"}`}>
                                            <m.icon size={15} /> {m.label}
                                        </button>
                                    ))}
                                </div>
                                {method === "Múltiplos" && (
                                    <div className="mt-3 space-y-2">
                                        {multi.map((p, i) => (
                                            <div key={i} className="flex gap-2">
                                                <select value={p.method} onChange={e => setMulti(ms => ms.map((x, j) => j === i ? { ...x, method: e.target.value } : x))} className="ui-input w-36" aria-label="Forma">
                                                    {["PIX", "Cartão", "Dinheiro"].map(o => <option key={o}>{o}</option>)}
                                                </select>
                                                <input defaultValue={p.value ? p.value.toFixed(2).replace(".", ",") : ""} onChange={e => { const v = toNumber(e.target.value); setMulti(ms => ms.map((x, j) => j === i ? { ...x, value: v } : x)); }}
                                                    inputMode="decimal" placeholder="R$ 0,00" className="ui-input flex-1 text-right tabular" aria-label="Valor" />
                                                <button onClick={() => setMulti(ms => ms.filter((_, j) => j !== i))} aria-label="Remover pagamento" className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-subtle hover:bg-danger-soft hover:text-danger"><Trash2 size={15} /></button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between text-sm">
                                            <button onClick={() => setMulti(ms => [...ms, { method: "PIX", value: 0 }])} className="inline-flex items-center gap-1 font-medium text-primary-text"><Plus size={14} /> Adicionar forma</button>
                                            <span className={multiError ? "text-danger" : "text-success"}>{formatBRL(multiSum)} de {formatBRL(total)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {stockChanges.length > 0 && (
                            <div className="rounded-xl border border-line bg-subtle px-3 py-2.5 text-sm">
                                <p className="mb-1 text-xs font-medium text-fg-subtle">Ao salvar, o estoque fica assim:</p>
                                <ul className="space-y-0.5">
                                    {stockChanges.map(c => (
                                        <li key={c.name} className="flex justify-between gap-3">
                                            <span className="truncate text-fg-muted">{c.name}</span>
                                            <span className={`shrink-0 font-medium tabular ${c.d > 0 ? "text-danger" : "text-success"}`}>{c.d > 0 ? `sai ${c.d}` : `volta ${-c.d}`}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
                    </div>
                )}

                <div className="space-y-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-fg-subtle">Subtotal <b className="text-fg tabular">{formatBRL(gross)}</b></span>
                        <label className="flex items-center gap-2 text-fg-subtle">Desconto
                            <input value={discount} onChange={e => setDiscount(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" placeholder="0,00" className="ui-input h-8 w-24 text-right tabular" aria-label="Desconto" />
                        </label>
                        <span className="text-fg-subtle">Total <b className="text-lg text-fg tabular">{formatBRL(total)}</b></span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={close} disabled={saving} className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-fg hover:bg-hover">Cancelar</button>
                        <button onClick={save} disabled={saving || loading || !lines.length || multiError}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
