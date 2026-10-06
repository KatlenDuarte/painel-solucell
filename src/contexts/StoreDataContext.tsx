// src/contexts/StoreDataContext.tsx
//
// Fonte única de "products" e "sales" da loja.
// Antes, cada tela/modal fazia getDocs() da coleção inteira ao montar
// (e de novo após cada ação), relendo milhares de documentos a cada troca de aba.
// Aqui abrimos listeners enquanto o usuário está logado: a carga inicial é lida uma vez
// e depois o Firestore só envia (e cobra) o que mudou. Vendas ficam limitadas a uma janela
// recente + fiados em aberto, para não reler o histórico inteiro a cada abertura do painel.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    collection,
    onSnapshot,
    query,
    where,
    Timestamp,
    type QueryDocumentSnapshot,
    type DocumentData,
} from "../lib/firestore";
import { db } from "../lib/firebase";

export type StoreDoc = QueryDocumentSnapshot<DocumentData>;

interface StoreDataValue {
    storeEmail: string;
    products: StoreDoc[];
    sales: StoreDoc[];
    productsLoading: boolean;
    salesLoading: boolean;
}

const StoreDataContext = createContext<StoreDataValue>({
    storeEmail: "",
    products: [],
    sales: [],
    productsLoading: true,
    salesLoading: true,
});

function useCollectionListener(name: string, storeEmail: string) {
    const store = storeEmail?.trim() || "";
    // Guarda de qual loja vieram os docs, para não exibir dados de outra loja durante a troca
    const [state, setState] = useState<{ store: string; docs: StoreDoc[] }>({ store: "", docs: [] });

    useEffect(() => {
        if (!store) return;

        const q = query(collection(db, name), where("store", "==", store));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => setState({ store, docs: snapshot.docs }),
            (error) => {
                console.error(`Erro ao escutar "${name}":`, error);
                setState({ store, docs: [] });
            }
        );
        return unsubscribe;
    }, [name, store]);

    const ready = !store || state.store === store;
    return [ready ? state.docs : [], !ready] as const;
}

/** Janela de vendas mantida em tempo real. Vendas mais antigas ficam só nos Relatórios. */
export const SALES_WINDOW_DAYS = 120;

/**
 * Vendas da loja SEM ler a coleção inteira a cada abertura (isso estourava a cota diária):
 *  - vendas dos últimos 120 dias;
 *  - todos os fiados em aberto, de qualquer data.
 * A consulta por loja + data precisa de um índice composto no Firestore. Se ele não existir,
 * usa só a data (lê também as vendas recentes das outras lojas, mas continua limitado à janela).
 */
function useSalesListener(storeEmail: string) {
    const store = storeEmail?.trim() || "";
    const [cutoff] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - SALES_WINDOW_DAYS);
        return Timestamp.fromDate(d);
    });
    const [useIndex, setUseIndex] = useState(true);
    const [recent, setRecent] = useState<{ store: string; docs: StoreDoc[] }>({ store: "", docs: [] });
    const [pending, setPending] = useState<{ store: string; docs: StoreDoc[] }>({ store: "", docs: [] });

    useEffect(() => {
        if (!store) return;
        const q = useIndex
            ? query(collection(db, "sales"), where("store", "==", store), where("timestamp", ">=", cutoff))
            : query(collection(db, "sales"), where("timestamp", ">=", cutoff));
        return onSnapshot(
            q,
            (snapshot) => setRecent({ store, docs: useIndex ? snapshot.docs : snapshot.docs.filter((d: StoreDoc) => d.data().store === store) }),
            (error) => {
                if ((error as { code?: string })?.code === "failed-precondition" && useIndex) {
                    // Falta o índice (store + timestamp). O link para criá-lo vem na mensagem abaixo.
                    console.warn("Índice de vendas por loja ainda não existe; usando consulta só por data.", error.message);
                    setUseIndex(false);
                    return;
                }
                console.error('Erro ao escutar "sales":', error);
                setRecent({ store, docs: [] });
            }
        );
    }, [store, cutoff, useIndex]);

    useEffect(() => {
        if (!store) return;
        // Igualdade em dois campos não precisa de índice composto
        const q = query(collection(db, "sales"), where("store", "==", store), where("status", "==", "pending"));
        return onSnapshot(
            q,
            (snapshot) => setPending({ store, docs: snapshot.docs }),
            (error) => {
                console.error('Erro ao escutar fiados em aberto:', error);
                setPending({ store, docs: [] });
            }
        );
    }, [store]);

    const ready = !store || (recent.store === store && pending.store === store);
    const docs = useMemo(() => {
        if (!ready) return [];
        const byId = new Map<string, StoreDoc>();
        recent.docs.forEach(d => byId.set(d.id, d));
        pending.docs.forEach(d => byId.set(d.id, d));
        return [...byId.values()];
    }, [ready, recent, pending]);
    return [docs, !ready] as const;
}

export function StoreDataProvider({ storeEmail, children }: { storeEmail: string; children: ReactNode }) {
    const [products, productsLoading] = useCollectionListener("products", storeEmail);
    const [sales, salesLoading] = useSalesListener(storeEmail);

    return (
        <StoreDataContext.Provider value={{ storeEmail, products, sales, productsLoading, salesLoading }}>
            {children}
        </StoreDataContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useStoreData = () => useContext(StoreDataContext);
