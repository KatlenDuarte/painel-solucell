import { collection, doc, setDoc, serverTimestamp, updateDoc, getDoc } from "../lib/firestore";
import { db } from "../lib/firebase";

// Define a interface para os itens de venda
export interface ProductSale {
    id: string;
    name: string;
    price: number;
    saleQty: number;
}

// Define a interface principal para os dados da venda (EXPORTADA)
export interface SaleData {
    store: string;
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    isFiado: boolean;
    expectedPaymentDate?: string; 
    distributedPayments?: Array<{ 
        method: string;
        value: number;
    }>;
    clientName?: string;
    clientPhone?: string;
    items: ProductSale[];
}

export const salesCollection = collection(db, "sales");

export const registerSaleAndAdjustStock = async (saleData: SaleData) => {
    // 1) Salva a venda
    const newSaleRef = doc(salesCollection);
    const saleToSave = {
        ...saleData,
        timestamp: serverTimestamp(),
    };

    await setDoc(newSaleRef, saleToSave);

    // 2) Para cada item vendido → reduzir estoque
    
    for (const item of saleData.items) {
        // Assume que 'products' é a coleção de produtos
        const productRef = doc(db, "products", item.id);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            const newStock = Math.max(0, currentStock - item.saleQty);

            await updateDoc(productRef, { stock: newStock });
        }
    }

    return { id: newSaleRef.id, ...saleToSave };
};