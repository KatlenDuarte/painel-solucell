import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;