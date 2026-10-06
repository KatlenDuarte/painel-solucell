import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  type DocumentData,
} from "../lib/firestore";
import { db } from "../lib/firebase";

export const maintenanceCollection = collection(db, "maintenances");

// ---------------------------------------------
// Criar manutenção REAL no Firestore
// CORREÇÃO: Função agora recebe APENAS 'data' e extrai 'store'
// ---------------------------------------------
export const addMaintenance = async (data: any) => {
  const storeEmail = data.store; // Extrai o storeEmail do objeto 'data'
  if (!storeEmail) throw new Error("E-mail da loja não fornecido.");

  const ref = doc(maintenanceCollection);

  const payload = {
    id: ref.id,
    store: storeEmail, // Usa o valor extraído

    // Cliente
    customer: data.customer || "",
    phone: data.phone || "",

    // Aparelho
    device: data.device || "",
    brand: data.brand || "",
    model: data.model || "",

    // Detalhes
    issue: data.issue || "",
    status: data.status || "pending",
    value: Number(data.value) || 0,
    paid: Boolean(data.paid),
    partOrdered: Boolean(data.partOrdered),

    // Datas
    orderDate: data.orderDate || "",
    deliveryDate: data.deliveryDate || "",

    notes: data.notes || "",
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, payload);
  return payload;
};

// ---------------------------------------------
// Buscar manutenções da loja
// ---------------------------------------------
export const fetchMaintenances = async (storeEmail: string) => {
  if (!storeEmail) return [];

  const q = query(maintenanceCollection, where("store", "==", storeEmail));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ---------------------------------------------
// Escutar manutenções da loja em tempo real
// (lê a coleção uma vez e depois só recebe o que mudou)
// ---------------------------------------------
export const subscribeMaintenances = (
  storeEmail: string,
  onData: (data: Array<{ id: string } & DocumentData>) => void,
  onError?: (error: unknown) => void
) => {
  const q = query(maintenanceCollection, where("store", "==", storeEmail));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
};

// ---------------------------------------------
// Atualizar manutenção
// ---------------------------------------------
export const updateMaintenance = async (id: string, data: any) => {
  const ref = doc(maintenanceCollection, id);
  await updateDoc(ref, data);
};

// ---------------------------------------------
// Deletar manutenção
// ---------------------------------------------
export const deleteMaintenance = async (id: string) => {
  const ref = doc(maintenanceCollection, id);
  await deleteDoc(ref);
};