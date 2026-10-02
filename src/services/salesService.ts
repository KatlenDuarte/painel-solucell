import {
  collection,
  doc,
  writeBatch,
  increment,
  Timestamp,
} from "firebase/firestore";

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
  const batch = writeBatch(db);
  const newSaleRef = doc(salesCollection);

  const now = Timestamp.now();

  const expectedDate =
    saleData.isFiado && saleData.expectedPaymentDate
      ? Timestamp.fromDate(
          new Date(`${saleData.expectedPaymentDate}T12:00:00`)
        )
      : null;

  const subtotal = Number(saleData.subtotal || 0);
  const discount = Number(saleData.discount || 0);
  const total = Number(saleData.total || 0);

  const saleToSave = {
    store: saleData.store,

    subtotal,
    discount,
    total,

    paymentMethod: saleData.isFiado ? "Fiado" : saleData.paymentMethod,

    isFiado: saleData.isFiado,

    status: saleData.isFiado ? "pending" : "completed",

    expectedPaymentDate: expectedDate,

    clientName: saleData.clientName || "",
    clientPhone: saleData.clientPhone || "",

    fiado: saleData.isFiado
      ? {
          nome: saleData.clientName || "",
          whatsapp: saleData.clientPhone || "",
          valor: total,
          data: expectedDate,
        }
      : null,

    distributedPayments: saleData.distributedPayments || [],

    items: saleData.items.map((item) => {
      const price = Number(item.price || 0);
      const saleQty = Number(item.saleQty || 1);

      return {
        id: item.id,
        name: item.name,
        price,
        saleQty,
        qty: saleQty,
        total: price * saleQty,
      };
    }),

    timestamp: now,
    createdAt: now,
  };

  batch.set(newSaleRef, saleToSave);

  for (const item of saleData.items) {
    const isNonCatalog = String(item.id).startsWith("non-catalog-");

    if (isNonCatalog) continue;
    if (!item.id || Number(item.saleQty || 0) <= 0) continue;

    const productRef = doc(db, "products", item.id);

    batch.update(productRef, {
      stock: increment(-Number(item.saleQty || 0)),
    });
  }

  await batch.commit();

  return {
    id: newSaleRef.id,
    ...saleToSave,
  };
};

export type { ProductSale, SaleData };