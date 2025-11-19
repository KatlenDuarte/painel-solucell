import { useState } from "react";
import type { Auth } from "firebase/auth";

interface LoginPageProps {
  auth: Auth;
  onLoginSuccess: (userEmail: string) => void;
}

const VALID_STORES = [
  "vilaesportiva@solucell.com",
  "jardimdagloria@solucell.com",
];

export default function LoginPage({ auth, onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const userEmail = userCredential.user.email || "";

      console.log("🔥 EMAIL LOGADO:", userEmail);

      if (!VALID_STORES.includes(userEmail)) {
        setError("Este usuário não pertence a nenhuma loja cadastrada.");
        setIsLoading(false);
        return;
      }

      onLoginSuccess(userEmail);
    } catch (err: any) {
      setError(err.message || "Erro ao tentar logar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-slate-950 dark:bg-slate-900">
      <form
        onSubmit={handleSubmit}
        className="p-10 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl w-96 text-center"
      >
        <h2 className="text-white text-3xl font-bold mb-6">
          Acesso ao Sistema 🔑
        </h2>

        <div className="space-y-4 mb-6">
          <input
            type="email"
            placeholder="Email da loja"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-700 focus:ring-emerald-500 focus:border-emerald-500 transition"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-700 focus:ring-emerald-500 focus:border-emerald-500 transition"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
