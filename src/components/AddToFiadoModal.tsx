// src/components/AddToFiadoModal.tsx
// Lança novos itens na conta de um cliente que já está devendo (fiado em aberto):
// soma na mesma dívida, sem criar outro fiado, e baixa o estoque.

import { useMemo, useState } from "react";
import { X, Search, Plus, Minus, Trash2, Loader2, PackagePlus, Tag } from "lucide-react";
import { useStoreData } from "../contexts/StoreDataContext";
import { addToFiado, type FiadoAddition } from "../lib/saleActions";
import { formatBRL } from "../lib/format";

interface Props {
    saleId: string;
    clientName: string;
    currentTotal: number;
    onClose: () => void;
    onDone: (added: number) => void;
}

type Line = FiadoAddition & { key: string; stock?: number };

const money = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export default function AddToFiadoModal({ saleId, clientName, currentTotal, onClose, onDone }: Props) {
    const { products } = useStoreData();
    const [search, setSearch] = useState("");
    const [lines, setLines] = useState<Line[]>([]);
    const [avulsoName, setAvulsoName] = useState("");
    const [avulsoPrice, setAvulsoPrice] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const catalog = useMemo(() => products.map(d => {
        const p = d.data();
        return { id: d.id, name: String(p.name || "Produto"), price: Number(p.price) || 0, stock: Number(p.stock) || 0, barcode: String(p.barcode || "") };
    }), [products]);

    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return catalog.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))).slice(0, 8);
    }, [catalog, search]);

    const inCart = (id: string) => lines.filter(l => l.id === id).reduce((s, l) => s + l.saleQty, 0);

    const addProduct = (p: typeof catalog[number]) => {
        setError("");
        if (inCart(p.id) >= p.stock) { setError(`Sem estoque suficiente de ${p.name} (disponível: ${p.stock}).`); return; }
        setLines(ls => {
            const ex = ls.find(l => l.id === p.id);
            if (ex) return ls.map(l => l.id === p.id ? { ...l, saleQty: l.saleQty + 1 } : l);
            return [...ls, { key: p.id, id: p.id, name: p.name, price: p.price, saleQty: 1, stock: p.stock }];
        });
        setSearch("");
    };

    const addAvulso = () => {
        const price = money(avulsoPrice);
        if (!avulsoName.trim() || price <= 0) { setError("Informe a descrição e o valor do item avulso."); return; }
        setError("");
        setLines(ls => [...ls, { key: `av-${Date.now()}`, name: avulsoName.trim(), price, saleQty: 1 }]);
        setAvulsoName(""); setAvulsoPrice("");
    };

    const changeQty = (key: string, delta: number) => setLines(ls => ls.map(l => {
        if (l.key !== key) return l;
        const q = Math.max(1, l.saleQty + delta);
        if (l.stock !== undefined && q > l.stock) { setError(`Estoque máximo de ${l.name}: ${l.stock}.`); return l; }
        return { ...l, saleQty: q };
    }));

    const addTotal = lines.reduce((s, l) => s + l.price * l.saleQty, 0);

    const confirm = async () => {
        if (!lines.length) { setError("Adicione pelo menos um item."); return; }
        setSaving(true); setError("");
        try {
            const added = await addToFiado(saleId, lines.map(({ id, name, price, saleQty }) => ({ id, name, price, saleQty })));
            onDone(added);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível lançar. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
            <div role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-w-lg sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-fg">Lançar na conta</h3>
                        <p className="mt-0.5 truncate text-sm text-fg-subtle">{clientName} · deve {formatBRL(currentTotal)}</p>
                    </div>
                    <button onClick={onClose} disabled={saving} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-subtle hover:bg-hover hover:text-fg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {/* Produto do estoque */}
                    <div>
                        <label className="ui-label">Produto do estoque</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
                            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou código de barras"
                                onKeyDown={e => { if (e.key === "Enter" && results[0]) addProduct(results[0]); }}
                                className="ui-input pl-9" aria-label="Buscar produto" />
                        </div>
                        {results.length > 0 && (
                            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                                {results.map(p => (
                                    <li key={p.id}>
                                        <button onClick={() => addProduct(p)} disabled={p.stock <= 0}
                                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-hover disabled:opacity-50">
                                            <span className="min-w-0 flex-1 truncate text-fg">{p.name}</span>
                                            <span className="text-xs text-fg-subtle">{p.stock <= 0 ? "sem estoque" : `${p.stock} un`}</span>
                                            <span className="w-20 text-right font-medium text-fg tabular">{formatBRL(p.price)}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Item avulso */}
                    <div>
                        <label className="ui-label">Item avulso (sem estoque)</label>
                        <div className="flex gap-2">
                            <input value={avulsoName} onChange={e => setAvulsoName(e.target.value)} placeholder="Descrição" className="ui-input min-w-0 flex-1" aria-label="Descrição do item avulso" />
                            <input value={avulsoPrice} onChange={e => setAvulsoPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" placeholder="R$ 0,00" className="ui-input w-28" aria-label="Valor do item avulso" />
                            <button onClick={addAvulso} className="inline-flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-sm font-medium text-fg hover:bg-hover"><Plus size={15} /> Incluir</button>
                        </div>
                    </div>

                    {/* Itens a lançar */}
                    {lines.length > 0 ? (
                        <ul className="divide-y divide-line rounded-xl border border-line">
                            {lines.map(l => (
                                <li key={l.key} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                                    {l.id ? <PackagePlus size={15} className="shrink-0 text-fg-faint" /> : <Tag size={15} className="shrink-0 text-fg-faint" />}
                                    <span className="min-w-0 flex-1 truncate text-fg">{l.name}</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => changeQty(l.key, -1)} aria-label="Diminuir" className="flex h-7 w-7 items-center justify-center rounded-lg border border-line hover:bg-hover"><Minus size={13} /></button>
                                        <span className="w-6 text-center tabular text-fg">{l.saleQty}</span>
                                        <button onClick={() => changeQty(l.key, 1)} aria-label="Aumentar" className="flex h-7 w-7 items-center justify-center rounded-lg border border-line hover:bg-hover"><Plus size={13} /></button>
                                    </div>
                                    <span className="w-20 text-right font-medium text-fg tabular">{formatBRL(l.price * l.saleQty)}</span>
                                    <button onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label="Remover" className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-subtle hover:bg-danger-soft hover:text-danger"><Trash2 size={14} /></button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-fg-subtle">Busque um produto ou inclua um item avulso.</p>
                    )}

                    {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
                </div>

                <div className="space-y-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-subtle px-2 py-2"><p className="text-fg-subtle">Devia</p><p className="text-sm font-semibold text-fg tabular">{formatBRL(currentTotal)}</p></div>
                        <div className="rounded-lg bg-subtle px-2 py-2"><p className="text-fg-subtle">Lançando</p><p className="text-sm font-semibold text-fg tabular">+ {formatBRL(addTotal)}</p></div>
                        <div className="rounded-lg bg-subtle px-2 py-2"><p className="text-fg-subtle">Vai dever</p><p className="text-sm font-semibold text-danger tabular">{formatBRL(currentTotal + addTotal)}</p></div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} disabled={saving} className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-fg hover:bg-hover">Cancelar</button>
                        <button onClick={confirm} disabled={saving || !lines.length}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Lançar na conta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
