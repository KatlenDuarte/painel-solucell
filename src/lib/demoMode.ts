// src/lib/demoMode.ts
// Modo demonstração: permite que visitantes (ex.: portfólio) usem o painel
// com dados fictícios, sem login e sem nenhum acesso ao Firebase real.

const KEY = "solucell-demo";

let active = (() => {
    try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
})();

export const isDemoMode = () => active;

export function enterDemoMode() {
    active = true;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

export function exitDemoMode() {
    active = false;
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const DEMO_STORE = "demo@solucell.com";
export const DEMO_USER = "visitante@demo";
