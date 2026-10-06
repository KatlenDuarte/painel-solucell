// src/lib/stores.ts
// Lojas do painel e troca rápida entre elas.
//
// Cada loja usa a sua própria "instância" do Firebase no navegador, com a sessão
// salva separadamente. Assim, depois de entrar uma vez em cada loja, a troca é
// instantânea (sem digitar senha). A loja ativa fica no localStorage.

export const STORES = [
    { email: "vilaesportiva@solucell.com", label: "Vila Esportiva" },
    { email: "jardimdagloria@solucell.com", label: "Jardim da Glória" },
] as const;

export const STORE_LABEL: Record<string, string> = {
    "vilaesportiva@solucell.com": "Vila Esportiva",
    "jardimdagloria@solucell.com": "Jardim da Glória",
    "teste@solucell.com": "Teste",
};

const ACTIVE_KEY = "solucell-loja-ativa";
// Loja que já estava logada na instância padrão antes de existir a troca rápida
const DEFAULT_KEY = "solucell-loja-padrao";

const read = (k: string) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

export const getActiveStore = () => read(ACTIVE_KEY);

/** Nome da instância do Firebase para a loja ativa ("[DEFAULT]" = padrão). */
export function appNameForActiveStore(): string | undefined {
    const active = read(ACTIVE_KEY);
    const def = read(DEFAULT_KEY);
    if (!active || active === def) return undefined;
    return "loja-" + active.split("@")[0].replace(/[^a-z0-9]/gi, "");
}

/**
 * Troca para outra loja e recarrega o painel.
 * `currentEmail` é a conta logada agora (para lembrar qual loja usa a instância padrão).
 */
export function switchStore(targetEmail: string, currentEmail: string) {
    if (!read(DEFAULT_KEY) && !appNameForActiveStore() && currentEmail) write(DEFAULT_KEY, currentEmail);
    write(ACTIVE_KEY, targetEmail);
    window.location.reload();
}
