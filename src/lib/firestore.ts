// src/lib/firestore.ts
// Camada única de acesso ao Firestore usada por todo o app.
//
// • Modo normal: repassa cada chamada para o SDK oficial (firebase/firestore).
// • Modo demonstração: as mesmas chamadas leem e gravam num banco em memória
//   (src/lib/demoData.ts). Nada é enviado ao Firebase real, e o visitante pode
//   usar o sistema normalmente; tudo volta ao estado inicial ao recarregar.
//
// As referências (collection/doc/query) continuam sendo objetos reais do SDK;
// apenas anexamos metadados (__demo) para o modo demonstração conseguir
// interpretá-las, então tipos e propriedades como `.id` e `.path` seguem iguais.

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from "firebase/firestore";
import { isDemoMode } from "./demoMode";
import { createDemoData, type DemoCollections, type DemoRecord } from "./demoData";
import { wrapDoc, wrapQuerySnap } from "./saleCompat";

export { Timestamp } from "firebase/firestore";
export type { DocumentData, QueryDocumentSnapshot, Firestore } from "firebase/firestore";

/* ----------------------------------------------------------- Banco demo */

let demoDb: DemoCollections | null = null;
const listeners = new Set<{ path: string; fire: () => void }>();

const demo = () => (demoDb ??= createDemoData());

export function resetDemoData() {
    demoDb = createDemoData();
    listeners.forEach(l => l.fire());
}

const collectionMap = (path: string) => {
    const db = demo();
    return (db[path] ??= new Map());
};

const notify = (path: string) => {
    queueMicrotask(() => listeners.forEach(l => { if (l.path === path) l.fire(); }));
};

const clone = <T,>(v: T): T => {
    if (v instanceof fs.Timestamp) return v;
    if (Array.isArray(v)) return v.map(clone) as T;
    if (v && typeof v === "object") {
        const out: any = {};
        Object.entries(v as any).forEach(([k, val]) => { out[k] = clone(val); });
        return out;
    }
    return v;
};

const comparable = (v: any) =>
    v instanceof fs.Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : v;

const getField = (data: any, field: string) =>
    field.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), data);

function applyWrite(target: any, data: Record<string, any>) {
    Object.entries(data).forEach(([key, value]) => {
        const parts = key.split(".");
        let obj = target;
        parts.slice(0, -1).forEach(p => { obj = obj[p] ??= {}; });
        const last = parts[parts.length - 1];
        if (value && value.__demoIncrement !== undefined) {
            obj[last] = (Number(obj[last]) || 0) + value.__demoIncrement;
        } else if (value && value.__demoDelete) {
            delete obj[last];
        } else {
            obj[last] = clone(value);
        }
    });
    return target;
}

const makeDocSnap = (path: string, id: string, data: DemoRecord | undefined) => ({
    id,
    ref: { id, path: `${path}/${id}` },
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
    get: (field: string) => getField(data, field),
    metadata: { hasPendingWrites: false, fromCache: false },
});

function runDemoQuery(meta: DemoQueryMeta) {
    let rows = [...collectionMap(meta.path).entries()];
    meta.constraints.forEach(c => {
        // No modo demo todos os dados pertencem à loja de demonstração
        if (c.type === "where" && c.field !== "store") {
            rows = rows.filter(([, d]) => {
                const a = comparable(getField(d, c.field));
                const b = comparable(c.value);
                switch (c.op) {
                    case "==": return a === b;
                    case "!=": return a !== b;
                    case "<": return a < b;
                    case "<=": return a <= b;
                    case ">": return a > b;
                    case ">=": return a >= b;
                    case "in": return Array.isArray(b) && b.includes(a);
                    case "array-contains": return Array.isArray(a) && a.includes(b);
                    default: return true;
                }
            });
        }
    });
    meta.constraints.filter(c => c.type === "orderBy").reverse().forEach(c => {
        const dir = c.direction === "desc" ? -1 : 1;
        rows.sort(([, x], [, y]) => {
            const a = comparable(getField(x, c.field));
            const b = comparable(getField(y, c.field));
            return a === b ? 0 : (a ?? 0) > (b ?? 0) ? dir : -dir;
        });
    });
    const lim = meta.constraints.find(c => c.type === "limit");
    if (lim) rows = rows.slice(0, lim.value);
    const docs = rows.map(([id, d]) => makeDocSnap(meta.path, id, d));
    return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (cb: (d: any) => void) => docs.forEach(cb),
        metadata: { hasPendingWrites: false, fromCache: false },
    };
}

/* ----------------------------------------------------------- Metadados */

interface DemoConstraint { type: "where" | "orderBy" | "limit"; field: string; op?: string; value?: any; direction?: string }
interface DemoQueryMeta { path: string; constraints: DemoConstraint[] }

const tag = <T extends object>(obj: T, meta: unknown): T => {
    Object.defineProperty(obj, "__demo", { value: meta, enumerable: false, configurable: true });
    return obj;
};
const metaOf = (obj: any) => obj?.__demo;

const splitPath = (path: string) => {
    const parts = path.split("/");
    return { col: parts.slice(0, -1).join("/"), id: parts[parts.length - 1] };
};

/* ----------------------------------------------------------- Referências */

export function collection(db: fs.Firestore, path: string, ...segments: string[]) {
    return fs.collection(db, path, ...segments);
}

export function doc(parent: any, path?: string, ...segments: string[]): fs.DocumentReference<fs.DocumentData> {
    if (path === undefined) return fs.doc(parent);
    return fs.doc(parent, path, ...segments);
}

export function where(field: string, op: fs.WhereFilterOp, value: unknown) {
    return tag(fs.where(field, op, value), { type: "where", field, op, value });
}

export function orderBy(field: string, direction: fs.OrderByDirection = "asc") {
    return tag(fs.orderBy(field, direction), { type: "orderBy", field, direction });
}

export function limit(n: number) {
    return tag(fs.limit(n), { type: "limit", field: "", value: n });
}

export function query(base: fs.CollectionReference<fs.DocumentData> | fs.Query<fs.DocumentData>, ...constraints: fs.QueryConstraint[]) {
    const prev: DemoQueryMeta | undefined = metaOf(base);
    const meta: DemoQueryMeta = {
        path: prev?.path ?? (base as fs.CollectionReference).path,
        constraints: [...(prev?.constraints ?? []), ...constraints.map(c => metaOf(c)).filter(Boolean)],
    };
    return tag(fs.query(base, ...constraints), meta);
}

const queryMeta = (q: any): DemoQueryMeta => metaOf(q) ?? { path: q.path, constraints: [] };

/* ----------------------------------------------------------- Valores especiais */

export function serverTimestamp(): any {
    return isDemoMode() ? fs.Timestamp.now() : fs.serverTimestamp();
}

export function increment(n: number): any {
    return isDemoMode() ? { __demoIncrement: n } : fs.increment(n);
}

export function deleteField(): any {
    return isDemoMode() ? { __demoDelete: true } : fs.deleteField();
}

/* ----------------------------------------------------------- Leitura */

export async function getDocs(q: any): Promise<fs.QuerySnapshot<fs.DocumentData>> {
    if (!isDemoMode()) return wrapQuerySnap(await fs.getDocs(q));
    return runDemoQuery(queryMeta(q)) as unknown as fs.QuerySnapshot<fs.DocumentData>;
}

export async function getDoc(ref: fs.DocumentReference<fs.DocumentData>): Promise<fs.DocumentSnapshot<fs.DocumentData>> {
    if (!isDemoMode()) return wrapDoc(await fs.getDoc(ref));
    const { col, id } = splitPath(ref.path);
    return makeDocSnap(col, id, collectionMap(col).get(id)) as unknown as fs.DocumentSnapshot<fs.DocumentData>;
}

export function onSnapshot(q: any, onNext: (snap: any) => void, onError?: (e: fs.FirestoreError) => void): fs.Unsubscribe {
    if (!isDemoMode()) return fs.onSnapshot(q, (snap: any) => onNext("docs" in snap ? wrapQuerySnap(snap) : wrapDoc(snap)), onError);

    const isDoc = q.type === "document";
    const path = isDoc ? splitPath(q.path).col : queryMeta(q).path;
    const fire = () => {
        if (isDoc) {
            const { col, id } = splitPath(q.path);
            onNext(makeDocSnap(col, id, collectionMap(col).get(id)));
        } else {
            onNext(runDemoQuery(queryMeta(q)));
        }
    };
    const entry = { path, fire };
    listeners.add(entry);
    queueMicrotask(fire);
    return () => { listeners.delete(entry); };
}

/* ----------------------------------------------------------- Escrita */

export async function addDoc(col: fs.CollectionReference<fs.DocumentData>, data: fs.DocumentData) {
    if (!isDemoMode()) return fs.addDoc(col, data);
    const ref = fs.doc(col);
    collectionMap(col.path).set(ref.id, applyWrite({}, data));
    notify(col.path);
    return ref;
}

export async function setDoc(ref: fs.DocumentReference<fs.DocumentData>, data: fs.DocumentData, options?: fs.SetOptions) {
    if (!isDemoMode()) return options ? fs.setDoc(ref, data, options) : fs.setDoc(ref, data);
    const { col, id } = splitPath(ref.path);
    const map = collectionMap(col);
    const base = options && "merge" in options && options.merge ? (map.get(id) ?? {}) : {};
    map.set(id, applyWrite(base, data));
    notify(col);
}

export async function updateDoc(ref: fs.DocumentReference<fs.DocumentData>, data: fs.DocumentData) {
    if (!isDemoMode()) return fs.updateDoc(ref, data);
    const { col, id } = splitPath(ref.path);
    const map = collectionMap(col);
    const current = map.get(id);
    if (!current) throw new Error(`Documento não encontrado: ${ref.path}`);
    map.set(id, applyWrite(current, data));
    notify(col);
}

export async function deleteDoc(ref: fs.DocumentReference<fs.DocumentData>) {
    if (!isDemoMode()) return fs.deleteDoc(ref);
    const { col, id } = splitPath(ref.path);
    collectionMap(col).delete(id);
    notify(col);
}

export async function runTransaction<T>(db: fs.Firestore, updateFn: (tx: fs.Transaction) => Promise<T>): Promise<T> {
    if (!isDemoMode()) return fs.runTransaction(db, tx => updateFn(new Proxy(tx, {
        get(target, prop, receiver) {
            if (prop === "get") return async (ref: fs.DocumentReference<fs.DocumentData>) => wrapDoc(await target.get(ref));
            const v = Reflect.get(target, prop, receiver);
            return typeof v === "function" ? v.bind(target) : v;
        },
    })));
    const tx = {
        get: (ref: fs.DocumentReference<fs.DocumentData>) => getDoc(ref),
        set: (ref: fs.DocumentReference<fs.DocumentData>, data: fs.DocumentData, options?: fs.SetOptions) => { setDoc(ref, data, options); return tx; },
        update: (ref: fs.DocumentReference<fs.DocumentData>, data: fs.DocumentData) => { updateDoc(ref, data); return tx; },
        delete: (ref: fs.DocumentReference<fs.DocumentData>) => { deleteDoc(ref); return tx; },
    };
    return updateFn(tx as unknown as fs.Transaction);
}
