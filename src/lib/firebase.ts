// src/lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8yO9df9lq4dzNtN36uyDkrLVhL7OP_Eg",
  authDomain: "solucell-painel.firebaseapp.com",
  projectId: "solucell-painel",
  storageBucket: "solucell-painel.firebasestorage.app",
  messagingSenderId: "49336250894",
  appId: "1:49336250894:web:b5e416b0918964cea7825f",
  measurementId: "G-8XDQ79WSE1"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços
export const auth = getAuth(app);

// Cache local persistente (IndexedDB): ao reabrir o painel, os listeners
// retomam do cache e o servidor só cobra os documentos que mudaram.
// Se o navegador não suportar IndexedDB (ex.: aba anônima em alguns
// navegadores), usa cache em memória para nunca impedir o funcionamento.
function createDb(): Firestore {
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB indisponível");
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn("Cache persistente indisponível, usando memória:", error);
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

export const db = createDb();
