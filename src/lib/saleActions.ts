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

export interface EditedItem {
    id?: string;          // id do produto (vazio = avulso)
    name: string;
    price: number;
    saleQty: number;
}

export interface PaymentEdit {
    paymentMethod: string;                                   // "PIX" | "Cartão" | "Dinheiro" | "Múltiplos" | ...
    multiplePayments?: { method: string; value: number }[];  // só em "Múltiplos"
}

/**
 * Edita os itens de uma venda (incluir, remover, mudar quantidade, desconto) e,
 * opcionalmente, a forma de pagamento. O estoque é acertado pela DIFERENÇA entre
 * o que estava na venda e o que ficou: item removido volta ao estoque, item
 * acrescentado sai do estoque. Tudo na mesma transação.
 */
export async function updateSaleItems(saleId: string, items: EditedItem[], discount: number, payment?: PaymentEdit) {
    const clean = items
        .map(i => ({ ...i, name: i.name.trim(), price: Math.max(0, Number(i.price) || 0), saleQty: Math.max(1, Math.floor(Number(i.saleQty) || 1)) }))
        .filter(i => i.name);
    if (!clean.length) throw new Error("A venda precisa ter pelo menos um item. Para desfazer a venda inteira, use Estornar.");
    const gross = clean.reduce((s, i) => s + i.price * i.saleQty, 0);
    const disc = Math.min(Math.max(0, Number(discount) || 0), gross);
    const total = Math.round((gross - disc) * 100) / 100;

    if (payment?.paymentMethod === "Múltiplos") {
        const sum = (payment.multiplePayments || []).reduce((s, p) => s + (Number(p.value) || 0), 0);
        if (Math.abs(sum - total) > 0.009) throw new Error(`A soma dos pagamentos (${sum.toFixed(2)}) precisa ser igual ao total (${total.toFixed(2)}).`);
    }

    await runTransaction(db, async (tx) => {
        const saleRef = doc(db, "sales", saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Venda não encontrada.");
        const sale = saleSnap.data() as Record<string, unknown>;
        if (sale.status === "refunded" || sale.status === "cancelled") throw new Error("Venda estornada/cancelada não pode ser editada.");
        const isLoss = sale.status === "loss" || sale.type === "perda";

        // Diferença por produto: positivo = sai do estoque; negativo = volta
        const before = stockItems(sale.items);
        const after = stockItems(clean);
        const delta = new Map<string, number>();
        for (const id of new Set([...before.keys(), ...after.keys()])) {
            const d = (after.get(id) || 0) - (before.get(id) || 0);
            if (d !== 0) delta.set(id, d);
        }

        const products: { ref: ReturnType<typeof doc>; stock: number; d: number }[] = [];
        for (const [productId, d] of delta) {
            const ref = doc(db, "products", productId);
            const snap = await tx.get(ref);
            if (!snap.exists()) {
                if (d > 0) throw new Error("Um dos produtos incluídos não existe mais no estoque.");
                continue; // produto excluído: nada a devolver
            }
            const data = snap.data() as Record<string, unknown>;
            const stock = Number(data.stock) || 0;
            if (d > stock) throw new Error(`Estoque insuficiente de ${String(data.name || "produto")}: disponível ${stock}, precisa de mais ${d}.`);
            products.push({ ref, stock, d });
        }

        const now = new Date().toISOString();
        const newItems = clean.map(i => ({
            id: i.id || `avulso-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: i.name,
            price: i.price,
            saleQty: i.saleQty,
            qty: i.saleQty,
            total: Math.round(i.price * i.saleQty * 100) / 100,
        }));

        const update: Record<string, unknown> = {
            items: newItems,
            subtotal: Math.round(gross * 100) / 100,
            discount: disc,
            total,
            editedAt: now,
        };
        if (sale.status === "pending" && sale.fiado && typeof sale.fiado === "object") {
            update.fiado = { ...(sale.fiado as Record<string, unknown>), valor: total };
        }
        if (payment && !isLoss && sale.status !== "pending") {
            const pm = payment.paymentMethod;
            if (pm === "Múltiplos") {
                const mp = (payment.multiplePayments || []).map(p => ({ method: p.method, value: Number(p.value) || 0 }));
                const by = (k: string) => mp.filter(p => p.method.toUpperCase().includes(k)).reduce((s, p) => s + p.value, 0);
                Object.assign(update, { paymentMethod: "Múltiplos", multiplePayments: mp, payments: { pix: by("PIX"), cartao: by("CART"), dinheiro: by("DINHEIRO") } });
            } else {
                const up = pm.toUpperCase();
                Object.assign(update, {
                    paymentMethod: pm,
                    multiplePayments: null,
                    payments: { pix: up === "PIX" ? total : 0, cartao: up.startsWith("CART") ? total : 0, dinheiro: up === "DINHEIRO" ? total : 0 },
                });
            }
        }

        for (const p of products) tx.update(p.ref, { stock: p.stock - p.d });
        tx.update(saleRef, update);
    });
    return total;
}

/** Mensagem amigável para erros do Firebase mostrados nas telas. */
export function friendlyError(e: unknown, fallback: string) {
    const code = (e as { code?: string })?.code || "";
    if (code === "resource-exhausted") return "O limite diário do Firebase foi atingido. Tente de novo mais tarde (a cota renova todo dia de madrugada).";
    if (code === "permission-denied") return "Sem permissão no Firebase para esta ação. Verifique as regras de segurança.";
    if (code === "unavailable") return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    return e instanceof Error && e.message && !e.message.startsWith("FirebaseError") && !code ? e.message : fallback;
}
