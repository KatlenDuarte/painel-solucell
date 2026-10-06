// src/lib/saleActions.ts
// Operações que mexem em venda + estoque ao mesmo tempo, sempre em transação:
// ou tudo é gravado, ou nada (o estoque nunca fica pela metade).

import { doc, runTransaction, serverTimestamp } from "./firestore";
import { db } from "./firebase";

/** Itens sem estoque: avulsos (sem cadastro) e serviços. */
const isStockless = (id: string) => !id || id.startsWith("avulso-") || id.startsWith("non-catalog-");

/** Soma as quantidades por produto. */
function stockItems(items: unknown): Map<string, number> {
    const map = new Map<string, number>();
    if (!Array.isArray(items)) return map;
    for (const raw of items) {
        const it = raw as { id?: unknown; saleQty?: unknown; quantity?: unknown };
        const id = it?.id ? String(it.id) : "";
        if (isStockless(id)) continue;
        const qty = Number(it.saleQty ?? it.quantity ?? 1) || 0;
        if (qty > 0) map.set(id, (map.get(id) || 0) + qty);
    }
    return map;
}

/**
 * Estorna (status "refunded") ou cancela (status "cancelled") uma venda/fiado,
 * devolvendo os produtos ao estoque.
 */
export async function refundSale(saleId: string, newStatus: "refunded" | "cancelled" = "refunded") {
    await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Venda não encontrada.");
        const sale = saleSnap.data() as Record<string, unknown>;
        if (sale.status === "refunded") throw new Error("Esta venda já foi estornada.");
        if (sale.status === "cancelled") throw new Error("Esta venda já está cancelada.");

        // Lê tudo antes de gravar (exigência das transações do Firestore)
        const products: { ref: ReturnType<typeof doc>; stock: number; qty: number }[] = [];
        for (const [productId, qty] of stockItems(sale.items)) {
            const ref = doc(db, "products", productId);
            const snap = await tx.get(ref);
            if (!snap.exists()) continue; // produto excluído: não há estoque para devolver
            products.push({ ref, stock: Number(snap.data()?.stock) || 0, qty });
        }

        for (const p of products) tx.update(p.ref, { stock: p.stock + p.qty });
        tx.update(saleRef, {
            status: newStatus,
            previousStatus: sale.status ?? null,
            [newStatus === "refunded" ? "refundedAt" : "cancelledAt"]: serverTimestamp(),
            stockRestored: products.map(p => ({ id: p.ref.id, qty: p.qty })),
        });
    });
}

export interface FiadoAddition {
    id?: string;          // id do produto (vazio = item avulso, sem estoque)
    name: string;
    price: number;
    saleQty: number;
}

/**
 * Lança novos itens na conta de um fiado em aberto: soma no valor devido,
 * acrescenta os itens à mesma conta e baixa o estoque.
 */
export async function addToFiado(saleId: string, additions: FiadoAddition[], discount = 0) {
    const clean = additions
        .map(a => ({ ...a, price: Number(a.price) || 0, saleQty: Math.max(1, Math.floor(Number(a.saleQty) || 1)) }))
        .filter(a => a.name.trim() && a.price >= 0);
    if (!clean.length) throw new Error("Adicione pelo menos um item.");
    const gross = clean.reduce((s, a) => s + a.price * a.saleQty, 0);
    const addTotal = Math.round((gross - Math.max(0, Number(discount) || 0)) * 100) / 100;
    if (addTotal <= 0) throw new Error("O valor lançado precisa ser maior que zero.");

    await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Fiado não encontrado.");
        const sale = saleSnap.data() as Record<string, unknown>;
        if (sale.status !== "pending") throw new Error("Este fiado não está mais em aberto.");

        const products: { ref: ReturnType<typeof doc>; stock: number; qty: number; name: string }[] = [];
        for (const [productId, qty] of stockItems(clean)) {
            const ref = doc(db, "products", productId);
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error("Um dos produtos não existe mais no estoque.");
            const data = snap.data() as Record<string, unknown>;
            const stock = Number(data.stock) || 0;
            const name = String(data.name || "produto");
            if (stock < qty) throw new Error(`Estoque insuficiente de ${name}: disponível ${stock}, pedido ${qty}.`);
            products.push({ ref, stock, qty, name });
        }

        const now = new Date();
        const newItems = clean.map(a => ({
            id: a.id || `avulso-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
            name: a.name.trim(),
            price: a.price,
            saleQty: a.saleQty,
            qty: a.saleQty,
            total: Math.round(a.price * a.saleQty * 100) / 100,
            addedAt: now.toISOString(),
        }));
        const oldItems = Array.isArray(sale.items) ? sale.items : [];
        const oldTotal = Number(sale.total) || 0;
        const newTotal = Math.round((oldTotal + addTotal) * 100) / 100;
        const fiado = (sale.fiado && typeof sale.fiado === "object" ? sale.fiado : {}) as Record<string, unknown>;
        const history = Array.isArray(sale.fiadoLancamentos) ? sale.fiadoLancamentos : [];

        for (const p of products) tx.update(p.ref, { stock: p.stock - p.qty });
        tx.update(saleRef, {
            items: [...oldItems, ...newItems],
            total: newTotal,
            subtotal: Math.round(((Number(sale.subtotal) || oldTotal) + addTotal) * 100) / 100,
            fiado: { ...fiado, valor: newTotal },
            fiadoLancamentos: [...history, { data: now.toISOString(), valor: addTotal, desconto: Math.max(0, Number(discount) || 0), itens: newItems.map(i => `${i.saleQty}× ${i.name}`) }],
            updatedAt: serverTimestamp(),
        });
    });
    return addTotal;
}
