import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8yO9df9lq4dzNtN36uyDkrLVhL7OP_Eg",
  authDomain: "solucell-painel.firebaseapp.com",
  projectId: "solucell-painel",
  storageBucket: "solucell-painel.firebasestorage.app",
  messagingSenderId: "49336250894",
  appId: "1:49336250894:web:b5e416b0918964cea7825f",
  measurementId: "G-8XDQ79WSE1"
};

// Inicializa Firebase apenas uma vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth e Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// Helper para pegar usuário logado e claims
const getCurrentUserWithClaims = async (): Promise<null | { user: User; claims: any }> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return resolve(null);

      const idTokenResult = await user.getIdTokenResult(true); // força atualização do token
      resolve({ user, claims: idTokenResult.claims });
    });
  });
};

export { app, auth, db, getCurrentUserWithClaims };