import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Sun, Moon, Check, Loader2, PlayCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { STORES, STORE_LABEL } from "../lib/stores";
import logo from "../assets/logo-solucelll.png";

interface LoginPageProps {
  externalError?: string;
  onClearError?: () => void;
  onDemo?: () => void;
  defaultEmail?: string;
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha inválidos.",
  "auth/invalid-login-credentials": "E-mail ou senha inválidos.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/user-not-found": "Usuário não encontrado.",
  "auth/invalid-email": "E-mail em formato inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Sem conexão com o servidor. Verifique a internet e tente novamente.",
};

export default function LoginPage({ externalError, onClearError, onDemo, defaultEmail }: LoginPageProps) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const shownError = error || externalError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    onClearError?.();
    setIsLoading(true);

    try {
      // O App reage ao login via onAuthStateChanged
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setError(AUTH_ERRORS[code] || `Não foi possível entrar (${code || "erro desconhecido"}).`);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 grid bg-bg font-sans lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca */}
      <aside className="relative hidden overflow-hidden bg-[#111318] lg:flex lg:flex-col lg:justify-between p-12 text-white">
        <div className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#ea580c]/25 blur-[120px]" />
        <div className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-[#ea580c]/10 blur-[120px]" />
        <img src={logo} alt="Solucell" className="relative h-10 w-auto self-start object-contain" />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Gestão completa da loja em um só lugar.</h1>
          <p className="mt-4 text-base text-white/60">Vendas, estoque, fiado, ordens de serviço e fechamento de caixa — sincronizados em tempo real.</p>
          <ul className="mt-8 space-y-3 text-sm text-white/75">
            {["Caixa e vendas do dia em tempo real", "Controle de estoque com etiquetas e leitor", "Relatórios e fechamento em PDF"].map(t => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ea580c]/20 text-[#fb923c]"><Check className="h-3 w-3" strokeWidth={3} /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Solucell</p>
      </aside>

      {/* Formulário */}
      <main className="relative flex items-center justify-center p-6">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-hover hover:text-fg"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <img src={logo} alt="Solucell" className="mb-10 h-9 w-auto object-contain lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight text-fg">Entrar no painel</h2>
          <p className="mt-1.5 text-sm text-fg-subtle">
            {defaultEmail && STORE_LABEL[defaultEmail]
              ? <>Entre na loja <b className="text-fg">{STORE_LABEL[defaultEmail]}</b>. A senha só é pedida na primeira vez; depois a troca entre as lojas é direta.</>
              : "Escolha a loja e digite a senha."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {STORES.map(st => (
              <button key={st.email} type="button" onClick={() => setEmail(st.email)}
                className={`h-10 rounded-lg border text-sm font-medium transition-colors ${email === st.email ? "border-primary/50 bg-primary-soft text-primary-text" : "border-line text-fg-muted hover:bg-hover"}`}>
                {st.label}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="ui-label" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="loja@solucell.com"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="ui-input h-10"
              />
            </div>
            <div>
              <label className="ui-label" htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="ui-input h-10"
              />
            </div>
          </div>

          {shownError && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{shownError}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white shadow-[var(--ui-shadow)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Entrando..." : "Entrar"}
          </button>

          {onDemo && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-fg-faint">
                <span className="h-px flex-1 bg-line" />
                ou
                <span className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                onClick={onDemo}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-fg shadow-[var(--ui-shadow)] transition-colors hover:bg-hover"
              >
                <PlayCircle className="h-[18px] w-[18px] text-primary" />
                Ver demonstração
              </button>
              <p className="mt-2.5 text-center text-xs text-fg-subtle">
                Acesse o sistema completo com dados fictícios, sem precisar de login.
              </p>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
