// src/lib/demoData.ts
// Dados fictícios do modo demonstração (gerados no navegador a cada sessão).

import { Timestamp } from "firebase/firestore";
import { DEMO_STORE } from "./demoMode";

export type DemoRecord = Record<string, unknown>;
export type DemoCollections = Record<string, Map<string, DemoRecord>>;

// Gerador pseudoaleatório determinístico: a demonstração é sempre igual
function rng(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

const PRODUCTS = [
    { name: "Película 3D iPhone 13", brand: "Apple", model: "iPhone 13", category: "peliculas", price: 35, costPrice: 8, stock: 3, minStock: 6 },
    { name: "Película 3D iPhone 15", brand: "Apple", model: "iPhone 15", category: "peliculas", price: 40, costPrice: 9, stock: 18, minStock: 6 },
    { name: "Película privacidade Galaxy S23", brand: "Samsung", model: "Galaxy S23", category: "peliculas", price: 45, costPrice: 12, stock: 9, minStock: 4 },
    { name: "Película cerâmica Redmi Note 12", brand: "Xiaomi", model: "Redmi Note 12", category: "peliculas", price: 30, costPrice: 7, stock: 0, minStock: 4 },
    { name: "Capa silicone iPhone 14", brand: "Apple", model: "iPhone 14", category: "cases", price: 59.9, costPrice: 18, stock: 12, minStock: 4 },
    { name: "Capa anti-impacto Galaxy A54", brand: "Samsung", model: "Galaxy A54", category: "cases", price: 49.9, costPrice: 14, stock: 2, minStock: 4 },
    { name: "Capa carteira Moto G84", brand: "Motorola", model: "Moto G84", category: "cases", price: 69.9, costPrice: 22, stock: 7, minStock: 3 },
    { name: "Capa transparente iPhone 15 Pro", brand: "Apple", model: "iPhone 15 Pro", category: "cases", price: 45, costPrice: 11, stock: 15, minStock: 5 },
    { name: "Cabo USB-C 1m reforçado", brand: "Baseus", model: "USB-C", category: "cabos", price: 39.9, costPrice: 12, stock: 25, minStock: 8 },
    { name: "Cabo Lightning 2m", brand: "Baseus", model: "Lightning", category: "cabos", price: 49.9, costPrice: 15, stock: 4, minStock: 6 },
    { name: "Cabo USB-C para USB-C 60W", brand: "Ugreen", model: "USB-C 60W", category: "cabos", price: 59.9, costPrice: 19, stock: 11, minStock: 5 },
    { name: "Carregador turbo 20W", brand: "Xiaomi", model: "20W", category: "acessorios", price: 89.9, costPrice: 35, stock: 8, minStock: 4 },
    { name: "Fone Bluetooth TWS", brand: "QCY", model: "T13", category: "acessorios", price: 129, costPrice: 60, stock: 6, minStock: 3 },
    { name: "Suporte veicular magnético", brand: "Baseus", model: "Magnético", category: "acessorios", price: 79.9, costPrice: 28, stock: 1, minStock: 3 },
    { name: "Power bank 10.000 mAh", brand: "Anker", model: "PowerCore", category: "acessorios", price: 159, costPrice: 82, stock: 5, minStock: 2 },
];

const CLIENTS = [
    { nome: "Ana Souza", whatsapp: "21987654321" },
    { nome: "Bruno Carvalho", whatsapp: "21991234567" },
    { nome: "Carla Mendes", whatsapp: "21998887766" },
    { nome: "Diego Ramos", whatsapp: "21976543210" },
    { nome: "Fernanda Lima", whatsapp: "21993334455" },
];

const REPAIRS = [
    { device: "iPhone 11", brand: "Apple", model: "A2221", issue: "Troca de tela (display trincado)", value: 420, partCost: 210 },
    { device: "Galaxy A32", brand: "Samsung", model: "SM-A325", issue: "Bateria não segura carga", value: 180, partCost: 75 },
    { device: "Moto G9 Play", brand: "Motorola", model: "XT2083", issue: "Conector de carga com mau contato", value: 120, partCost: 30 },
    { device: "Redmi Note 10", brand: "Xiaomi", model: "M2101K7AG", issue: "Câmera traseira desfocada", value: 260, partCost: 120 },
    { device: "iPhone XR", brand: "Apple", model: "A1984", issue: "Face ID não funciona após queda", value: 350, partCost: 160 },
    { device: "Galaxy S21", brand: "Samsung", model: "SM-G991", issue: "Tampa traseira quebrada", value: 190, partCost: 80 },
];

const ts = (d: Date) => Timestamp.fromDate(d);

function daysAgo(n: number, hour: number, minute: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, minute, 0, 0);
    return d;
}

export function createDemoData(): DemoCollections {
    const rand = rng(42);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const db: DemoCollections = {
        products: new Map(),
        sales: new Map(),
        maintenances: new Map(),
        cash_sessions: new Map(),
        outflows: new Map(),
    };

    // ---------- Produtos
    PRODUCTS.forEach((p, i) => {
        const id = `demo-prod-${i + 1}`;
        db.products.set(id, {
            ...p,
            nameLower: p.name.toLowerCase(),
            barcode: `789100${String(1000 + i * 37).padStart(6, "0")}`,
            supplier: pick(["Distribuidora Sol", "Importadora Rio", "Atacado Centro"]),
            store: DEMO_STORE,
        });
    });
    const productIds = [...db.products.keys()];

    // ---------- Vendas dos últimos 45 dias
    let n = 0;
    for (let day = 44; day >= 0; day--) {
        const now = new Date();
        const count = day === 0 ? 7 : 3 + Math.floor(rand() * 6);
        for (let k = 0; k < count; k++) {
            const hour = 9 + Math.floor(rand() * 10);
            const minute = Math.floor(rand() * 60);
            const when = daysAgo(day, hour, minute);
            if (day === 0 && when > now) when.setTime(now.getTime() - (count - k) * 25 * 60000);

            const id = `demo-sale-${++n}`;
            const nItems = 1 + Math.floor(rand() * 2);
            const items = Array.from({ length: nItems }, () => {
                const pid = pick(productIds);
                const p = db.products.get(pid)!;
                return { id: pid, name: p.name as string, price: p.price as number, saleQty: 1 + (rand() < 0.2 ? 1 : 0) };
            });
            const total = Math.round(items.reduce((a, it) => a + it.price * it.saleQty, 0) * 100) / 100;
            const r = rand();
            const method = r < 0.45 ? "PIX" : r < 0.75 ? "Cartão" : r < 0.92 ? "Dinheiro" : "Múltiplos";
            const sale: DemoRecord = {
                items, subtotal: total, discount: 0, total, type: "venda",
                paymentMethod: method, status: "completed", store: DEMO_STORE, timestamp: ts(when),
                payments: {
                    pix: method === "PIX" ? total : 0,
                    cartao: method === "Cartão" ? total : 0,
                    dinheiro: method === "Dinheiro" ? total : 0,
                    fiado: { valor: 0, nome: "", whatsapp: "", data: "" },
                },
            };
            if (method === "Múltiplos") {
                const pix = Math.round(total * 0.6 * 100) / 100;
                sale.multiplePayments = [{ method: "PIX", value: pix }, { method: "DINHEIRO", value: Math.round((total - pix) * 100) / 100 }];
            }
            if (rand() < 0.03) sale.status = "refunded";
            db.sales.set(id, sale);
        }
    }

    // ---------- Serviços (manutenção registrada como venda)
    REPAIRS.slice(0, 4).forEach((rep, i) => {
        const id = `demo-sale-mnt-${i + 1}`;
        db.sales.set(id, {
            items: [{ name: `MNT: ${rep.device} – ${rep.issue}`, price: rep.value, saleQty: 1 }],
            total: rep.value, subtotal: rep.value, discount: 0, type: "manutencao", partCost: rep.partCost,
            clientName: CLIENTS[i].nome, paymentMethod: i % 2 ? "PIX" : "Cartão", status: "completed",
            store: DEMO_STORE, timestamp: ts(daysAgo(i * 3, 15, 20)),
        });
    });

    // ---------- Fiados (pendentes e quitados)
    [
        { c: 0, d: 2, items: [0, 8], status: "pending" },
        { c: 1, d: 9, items: [12], status: "pending" },
        { c: 2, d: 23, items: [5, 9], status: "pending" },
        { c: 3, d: 35, items: [11], status: "fiado_quitado" },
        { c: 4, d: 18, items: [4], status: "fiado_quitado" },
    ].forEach((f, i) => {
        const items = f.items.map(idx => {
            const pid = productIds[idx];
            const p = db.products.get(pid)!;
            return { id: pid, name: p.name as string, price: p.price as number, saleQty: 1 };
        });
        const total = Math.round(items.reduce((a, it) => a + it.price, 0) * 100) / 100;
        const client = CLIENTS[f.c];
        const fiado = { valor: total, nome: client.nome, whatsapp: client.whatsapp, data: "" };
        db.sales.set(`demo-fiado-${i + 1}`, {
            items, total, subtotal: total, discount: 0, type: "venda",
            paymentMethod: f.status === "pending" ? "Fiado" : "Fiado (Quitado)",
            originalPaymentMethod: "Fiado",
            status: f.status, fiado, clientName: client.nome,
            note: f.status === "pending" ? "Combinou de pagar no dia 10" : "",
            store: DEMO_STORE, timestamp: ts(daysAgo(f.d, 16, 5)),
            ...(f.status === "fiado_quitado" ? { paidAt: ts(daysAgo(Math.max(0, f.d - 7), 11, 40)) } : {}),
        });
    });

    // ---------- Ordens de serviço
    const statuses = ["pending", "parts_ordered", "in_progress", "completed", "completed", "in_progress"];
    REPAIRS.forEach((rep, i) => {
        const id = `demo-os-${i + 1}`;
        const created = daysAgo(i === 0 ? 0 : i * 2, 10 + i, 15);
        db.maintenances.set(id, {
            id, store: "minha-loja@exemplo.com",
            customer: CLIENTS[i % CLIENTS.length].nome, phone: CLIENTS[i % CLIENTS.length].whatsapp,
            device: rep.device, brand: rep.brand, model: rep.model, issue: rep.issue,
            status: statuses[i], value: rep.value, paid: statuses[i] === "completed" || i === 2,
            partOrdered: statuses[i] !== "pending", orderDate: "", deliveryDate: "", notes: "",
            createdAt: created.toISOString(),
        });
    });

    // ---------- Caixa aberto hoje
    const sessionId = "demo-cash-today";
    db.cash_sessions.set(sessionId, {
        store: DEMO_STORE, initialBalance: 150, status: "open", openedAt: ts(daysAgo(0, 8, 30)),
    });
    db.outflows.set("demo-out-1", { store: DEMO_STORE, sessionId, description: "Troco reforçado", amount: 50, type: "in", timestamp: ts(daysAgo(0, 9, 10)) });
    db.outflows.set("demo-out-2", { store: DEMO_STORE, sessionId, description: "Compra de material de limpeza", amount: 32.5, type: "out", timestamp: ts(daysAgo(0, 12, 45)) });

    return db;
}
