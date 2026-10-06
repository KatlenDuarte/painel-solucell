import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  increment,
  updateDoc,
  limit,
  orderBy,
} from "../lib/firestore";
import { db } from "../lib/firebase";

export const productsCollection = collection(db, "products");

// --------------------------------------------------
// Buscar produtos da loja
// --------------------------------------------------
export const fetchProducts = async (storeEmail: string) => {
  if (!storeEmail?.trim()) return [];

  const q = query(
    productsCollection,
    where("store", "==", storeEmail.trim())
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// --------------------------------------------------
// Buscar produtos por nome
// --------------------------------------------------
export const searchProducts = async (
  storeEmail: string,
  searchTerm: string,
  limitResults = 15
) => {
  if (!storeEmail?.trim() || !searchTerm.trim()) return [];

  const searchLower = searchTerm.trim().toLowerCase();

  const q = query(
    productsCollection,
    where("store", "==", storeEmail.trim()),
    where("nameLower", ">=", searchLower),
    where(
      "nameLower",
      "<",
      searchLower + "\uf8ff"
    ),
    limit(limitResults)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// --------------------------------------------------
// Criar produto
// --------------------------------------------------
export const addProduct = async (
  product: any,
  storeEmail: string
) => {
  if (!storeEmail?.trim()) {
    throw new Error(
      "E-mail da loja não fornecido."
    );
  }

  const ref = doc(productsCollection);

  const stock = Number(product.stock);
  const minStock = Number(product.minStock);
  const price = Number(product.price);
  const costPrice = Number(product.costPrice);

  const data = {
    id: ref.id,
    store: storeEmail.trim(),

    stock:
      Number.isFinite(stock) && stock >= 0
        ? stock
        : 0,

    minStock:
      Number.isFinite(minStock) && minStock >= 0
        ? minStock
        : 0,

    price:
      Number.isFinite(price) && price >= 0
        ? price
        : 0,

    costPrice:
      Number.isFinite(costPrice) &&
      costPrice >= 0
        ? costPrice
        : 0,

    name: product.name || "",
    brand: product.brand || "",
    model: product.model || "",
    category: product.category || "",

    barcode: product.barcode
      ? String(product.barcode).trim()
      : null,

    nameLower:
      String(product.name || "")
        .trim()
        .toLowerCase(),
  };

  await setDoc(ref, data);

  return data;
};

// --------------------------------------------------
// Atualizar produto
// --------------------------------------------------
export const updateProduct = async (
  id: string,
  data: any
) => {
  if (!id) {
    throw new Error(
      "ID do produto não informado."
    );
  }

  const productRef = doc(
    productsCollection,
    id
  );

  const cleaned: any = {};

  if (data.name !== undefined) {
    cleaned.name = data.name;
    cleaned.nameLower = String(
      data.name
    )
      .trim()
      .toLowerCase();
  }

  if (data.barcode !== undefined) {
    cleaned.barcode = data.barcode
      ? String(data.barcode).trim()
      : null;
  }

  if (data.brand !== undefined) {
    cleaned.brand = data.brand;
  }

  if (data.model !== undefined) {
    cleaned.model = data.model;
  }

  if (data.category !== undefined) {
    cleaned.category = data.category;
  }

  if (data.stock !== undefined) {
    const value = Number(data.stock);

    cleaned.stock =
      Number.isFinite(value) && value >= 0
        ? value
        : 0;
  }

  if (data.minStock !== undefined) {
    const value = Number(data.minStock);

    cleaned.minStock =
      Number.isFinite(value) && value >= 0
        ? value
        : 0;
  }

  if (data.price !== undefined) {
    const value = Number(data.price);

    cleaned.price =
      Number.isFinite(value) && value >= 0
        ? value
        : 0;
  }

  if (data.costPrice !== undefined) {
    const value = Number(
      data.costPrice
    );

    cleaned.costPrice =
      Number.isFinite(value) && value >= 0
        ? value
        : 0;
  }

  if (Object.keys(cleaned).length === 0) {
    return;
  }

  await updateDoc(
    productRef,
    cleaned
  );
};

// --------------------------------------------------
// Buscar produto por código de barras
// --------------------------------------------------
export const fetchProductByBarcode = async (
  storeEmail: string,
  barcode: string
) => {
  if (
    !storeEmail?.trim() ||
    !barcode?.trim()
  ) {
    return null;
  }

  const cleanBarcode = barcode.trim();

  const q = query(
    productsCollection,
    where(
      "store",
      "==",
      storeEmail.trim()
    ),
    where(
      "barcode",
      "==",
      cleanBarcode
    ),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];

  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
};

// --------------------------------------------------
// Ajustar estoque
// --------------------------------------------------
export const adjustStock = async (
  id: string,
  value: number,
  operation:
    | "add"
    | "remove"
    | "set"
) => {
  if (!id) {
    throw new Error(
      "ID do produto não informado."
    );
  }

  const productRef = doc(
    productsCollection,
    id
  );

  const qty = Number(value);

  if (
    !Number.isFinite(qty) ||
    qty < 0
  ) {
    throw new Error(
      "Quantidade inválida."
    );
  }

  if (operation === "set") {
    await updateDoc(
      productRef,
      {
        stock: qty,
      }
    );

    return;
  }

  await updateDoc(
    productRef,
    {
      stock: increment(
        operation === "add"
          ? qty
          : -qty
      ),
    }
  );
};

// --------------------------------------------------
// Deletar produto
// --------------------------------------------------
export const deleteProduct = async (
  id: string
) => {
  if (!id) {
    throw new Error(
      "ID do produto não informado."
    );
  }

  const productRef = doc(
    productsCollection,
    id
  );

  await deleteDoc(productRef);
};