// src/contexts/StoreDataContext.tsx
//
// Fonte única de "products" e "sales" da loja.
// Antes, cada tela/modal fazia getDocs() da coleção inteira ao montar
// (e de novo após cada ação), relendo milhares de documentos a cada troca de aba.
// Aqui abrimos UM listener por coleção enquanto o usuário está logado:
// a carga inicial é lida uma vez e depois o Firestore só envia (e cobra) o que mudou.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
    collection,
    onSnapshot,
    query,
    where,
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

export function StoreDataProvider({ storeEmail, children }: { storeEmail: string; children: ReactNode }) {
    const [products, productsLoading] = useCollectionListener("products", storeEmail);
    const [sales, salesLoading] = useCollectionListener("sales", storeEmail);

    return (
        <StoreDataContext.Provider value={{ storeEmail, products, sales, productsLoading, salesLoading }}>
            {children}
        </StoreDataContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useStoreData = () => useContext(StoreDataContext);
