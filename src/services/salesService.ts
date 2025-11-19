import { collection, doc, setDoc, serverTimestamp, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface ProductSale {
  id: string;
  name: string;
  price: number;
  saleQty: number;
}

interface SaleData {
  store: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  isFiado: boolean;
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

export type { ProductSale, SaleData };