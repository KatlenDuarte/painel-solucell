// src/lib/saleCompat.ts
// Compatibilidade com as vendas gravadas pelo painel anterior desta loja.
// O painel antigo guardava pagamento dividido em `distributedPayments` com "Múltiplo";
// as telas novas leem `multiplePayments`/"Múltiplos" e `payments`. A conversão é só na leitura:
// nada é alterado no banco.

type Payment = { method?: string; value?: number };

const upperMethod = (m: string) => {
    const s = (m || "").trim().toUpperCase();
    if (s.startsWith("CART")) return "CARTÃO";
    return s;
};

export function normalizeSale(data: Record<string, unknown> | undefined) {
    if (!data) return data;
    const out: Record<string, unknown> = { ...data };
    const dist = Array.isArray(out.distributedPayments) ? (out.distributedPayments as Payment[]).filter(p => p && p.method) : [];
    const multi = Array.isArray(out.multiplePayments) ? (out.multiplePayments as Payment[]) : [];

    if (!multi.length && (dist.length > 1 || out.paymentMethod === "Múltiplo")) {
        out.multiplePayments = dist.map(p => ({ method: upperMethod(String(p.method)), value: Number(p.value) || 0 }));
    }
    if (out.paymentMethod === "Múltiplo") out.paymentMethod = "Múltiplos";

    // Relatórios usam payments { pix, cartao, dinheiro } nas vendas divididas
    if (!out.payments && Array.isArray(out.multiplePayments) && (out.multiplePayments as Payment[]).length) {
        const acc = { pix: 0, cartao: 0, dinheiro: 0 };
        for (const p of out.multiplePayments as Payment[]) {
            const m = upperMethod(String(p.method));
            if (m.includes("PIX")) acc.pix += Number(p.value) || 0;
            else if (m.includes("CART")) acc.cartao += Number(p.value) || 0;
            else if (m.includes("DINHEIRO")) acc.dinheiro += Number(p.value) || 0;
        }
        out.payments = acc;
    }
    return out;
}

/* Envolve os snapshots do Firestore para que `data()` de documentos de "sales" já venha convertido. */

type AnyDoc = { id: string; ref: { parent: { id: string } }; data: () => Record<string, unknown> | undefined; exists?: () => boolean; metadata?: unknown };

export function wrapDoc<T extends AnyDoc>(d: T): T {
    if (!d || d.ref?.parent?.id !== "sales") return d;
    return new Proxy(d, {
        get(target, prop, receiver) {
            if (prop === "data") return () => normalizeSale(target.data());
            if (prop === "get") return (f: string) => (normalizeSale(target.data()) as Record<string, unknown> | undefined)?.[f];
            const v = Reflect.get(target, prop, receiver);
            return typeof v === "function" ? v.bind(target) : v;
        },
    });
}

export function wrapQuerySnap<T extends { docs: AnyDoc[] }>(snap: T): T {
    if (!snap || !Array.isArray(snap.docs)) return snap;
    const docs = snap.docs.map(wrapDoc);
    return new Proxy(snap, {
        get(target, prop, receiver) {
            if (prop === "docs") return docs;
            if (prop === "forEach") return (cb: (d: AnyDoc, i: number) => void) => docs.forEach(cb);
            if (prop === "docChanges") return (...a: unknown[]) =>
                (target as unknown as { docChanges: (...a: unknown[]) => { doc: AnyDoc }[] }).docChanges(...a).map(c => ({ ...c, doc: wrapDoc(c.doc) }));
            const v = Reflect.get(target, prop, receiver);
            return typeof v === "function" ? v.bind(target) : v;
        },
    });
}
