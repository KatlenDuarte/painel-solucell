import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BookOpenText,
    Receipt,
    Wrench,
    BarChart3,
    Settings,
    Plus,
    LogOut,
    Sun,
    Moon,
    Grid2x2,
    X,
    Loader2,
    ChevronsUpDown,
    Check,
    Store,
    type LucideIcon,
} from "lucide-react";

// Imports das telas
import Dashboard from "./screens/DashboardPage";
import Sales from "./screens/SalesPage";               // Admin
import Reports from "./screens/ReportsPage";
import ProductsContent from "./screens/ProductsPage";
import LoginPage from "./screens/LoginPage";
import Maintenance from "./screens/MaintenancePage";
import SettingsPage from "./screens/SettingsPage";
import FiadoPage from "./screens/FiadoPage";
import FechamentoPage from "./screens/FechamentoPage";
import SalesFuncionarioPage from "./screens/SalesFuncionarioPage";  // Funcionário

// Import do modal de nova venda
import NewSaleModal from "./components/NewSaleModal";
import ErrorBoundary from "./components/ErrorBoundary";
import PinGate from "./components/PinGate";
import { STORES, STORE_LABEL, switchStore, getActiveStore } from "./lib/stores";
import { db } from "./lib/firebase";
import { doc, getDoc, setDoc } from "./lib/firestore";

import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { StoreDataProvider } from "./contexts/StoreDataContext";
import { useTheme } from "./contexts/ThemeContext";
import logo from "./assets/logo-solucelll.png";
import { isDemoMode, exitDemoMode, DEMO_STORE, DEMO_USER } from "./lib/demoMode";

const ADMIN_PERMISSIONS = ["dashboard", "products", "sales", "fiado", "fechamento", "maintenance", "reports", "settings"];

const DEMO_USER_INFO = {
    email: DEMO_USER,
    storeEmail: DEMO_STORE,
    role: "Administrador (demo)",
    permissions: ADMIN_PERMISSIONS,
};

// No modo demonstração a impressora local (printer-server) não existe:
// simula a resposta para os fluxos de impressão seguirem normalmente.
let printStubInstalled = false;
function installDemoPrintStub() {
    if (printStubInstalled) return;
    printStubInstalled = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (isDemoMode() && url.startsWith("http://localhost:3333")) {
            return Promise.resolve(new Response(JSON.stringify({ success: true, demo: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
        }
        return originalFetch(input, init);
    };
}

interface UserInfo {
    email: string;
    role: string;
    storeEmail: string;
    permissions: string[];
}

interface NavItem {
    id: string;
    name: string;
    short?: string;
    icon: LucideIcon;
}

// ==================== CONFIGURAÇÃO ====================
const DEFAULT_PIN = "9838";

// Lojas com acesso ao painel. Cada e-mail é uma loja com os próprios dados (campo "store").
const VALID_STORES = [
    "vilaesportiva@solucell.com",
    "jardimdagloria@solucell.com",
    "teste@solucell.com",
];


const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
    {
        title: "Operação",
        items: [
            { id: "sales", name: "Vendas", icon: ShoppingCart },
            { id: "fiado", name: "Fiado", icon: BookOpenText },
            { id: "fechamento", name: "Fechamento de caixa", short: "Caixa", icon: Receipt },
            { id: "maintenance", name: "Manutenção", short: "O.S.", icon: Wrench },
        ],
    },
    {
        title: "Gestão",
        items: [
            { id: "dashboard", name: "Dashboard", short: "Início", icon: LayoutDashboard },
            { id: "products", name: "Produtos", icon: Package },
            { id: "reports", name: "Relatórios", icon: BarChart3 },
        ],
    },
    {
        title: "Sistema",
        items: [
            { id: "settings", name: "Configurações", short: "Ajustes", icon: Settings },
        ],
    },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);

/** Itens fixos da barra inferior no celular (o restante fica em "Mais"). */
const MOBILE_PRIMARY = ["sales", "fiado", "fechamento", "maintenance"];

function ThemeToggle({ className = "" }: { className?: string }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";
    return (
        <button
            onClick={toggleTheme}
            title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${className}`}
        >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>
    );
}

type AuthState = "checking" | "signed-out" | "signed-in";

function App() {
    const [currentPage, setCurrentPage] = useState(() => (isDemoMode() ? "dashboard" : "sales"));
    const [authState, setAuthState] = useState<AuthState>(() => (isDemoMode() ? "signed-in" : "checking"));
    const [authError, setAuthError] = useState("");
    const [moreOpen, setMoreOpen] = useState(false);
    const [storeMenuOpen, setStoreMenuOpen] = useState(false);
    // Recarregou a página durante a demonstração: continua na demo
    const [currentUser, setCurrentUser] = useState<UserInfo>(() => {
        if (isDemoMode()) { installDemoPrintStub(); return DEMO_USER_INFO; }
        return { email: "", role: "", storeEmail: "", permissions: [] };
    });

    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // PIN que protege Produtos e Relatórios (settings/security, igual ao painel anterior)
    const [securityPin, setSecurityPin] = useState<string | null>(null);
    const [unlocked, setUnlocked] = useState<{ products: boolean; reports: boolean }>({ products: false, reports: false });

    const handleNavigation = (pageId: string) => {
        if (currentUser.permissions.includes(pageId)) {
            setCurrentPage(pageId);
            setMoreOpen(false);
            window.scrollTo({ top: 0 });
        }
    };

    // ==================== AUTENTICAÇÃO + PERMISSÕES ====================
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (isDemoMode()) return;
            if (!user) {
                setAuthState("signed-out");
                return;
            }

            const email = (user.email || "").toLowerCase().trim();

            // Conta autenticada no Firebase, mas sem acesso a este painel:
            // antes o app voltava ao login em silêncio, parecendo que o login "não funcionava".
            if (!VALID_STORES.includes(email)) {
                setAuthError(`A conta ${email || "informada"} não tem acesso a este painel.`);
                signOut(auth);
                setAuthState("signed-out");
                return;
            }

            // Todas as lojas entram como administradoras (como no painel anterior)
            setCurrentUser({
                email,
                storeEmail: email,
                role: "Administrador",
                permissions: ADMIN_PERMISSIONS,
            });
            setAuthError("");
            setAuthState("signed-in");
        });
        return () => unsubscribe();
    }, []);

    const demoActive = isDemoMode();

    useEffect(() => {
        if (authState !== "signed-in") return;
        if (isDemoMode()) return; // na demonstração o PIN é o padrão
        let alive = true;
        (async () => {
            try {
                const ref = doc(db, "settings", "security");
                const snap = await getDoc(ref);
                const pin = snap.exists() ? String(snap.data()?.pin || DEFAULT_PIN) : DEFAULT_PIN;
                if (!snap.exists()) await setDoc(ref, { pin: DEFAULT_PIN, updatedAt: new Date() });
                if (alive) setSecurityPin(pin);
            } catch (e) {
                // Sem permissão em "settings": usa o PIN salvo neste navegador (ou o padrão)
                if ((e as { code?: string })?.code !== "permission-denied") console.error("Erro ao carregar o PIN:", e);
                let local = "";
                try { local = localStorage.getItem("solucell-pin") || ""; } catch { /* sem armazenamento */ }
                if (alive) setSecurityPin(/^\d{4}$/.test(local) ? local : DEFAULT_PIN);
            }
        })();
        return () => { alive = false; };
    }, [authState]);

    const handleLogout = () => {
        setMoreOpen(false);
        setUnlocked({ products: false, reports: false });
        if (isDemoMode()) {
            exitDemoMode();
            setCurrentPage("sales");
            setAuthState(auth.currentUser ? "signed-in" : "signed-out");
            return;
        }
        signOut(auth);
    };

    const navSections = NAV_SECTIONS
        .map(section => ({ ...section, items: section.items.filter(item => currentUser.permissions.includes(item.id)) }))
        .filter(section => section.items.length > 0);

    const allowedItems = ALL_NAV_ITEMS.filter(item => currentUser.permissions.includes(item.id));
    const mobilePrimary = allowedItems.filter(item => MOBILE_PRIMARY.includes(item.id));
    const currentInPrimary = MOBILE_PRIMARY.includes(currentPage);
    const userName = currentUser.email.split("@")[0];
    const storeLabel = STORE_LABEL[currentUser.email] || userName;
    const otherStores = STORES.filter(st => st.email !== currentUser.email);

    const renderPage = () => {
        switch (currentPage) {
            case "dashboard": return <Dashboard />;
            case "products": return (
                <PinGate title="Produtos protegidos" requiredPin={demoActive ? DEFAULT_PIN : securityPin} unlocked={unlocked.products}
                    onUnlock={() => setUnlocked(u => ({ ...u, products: true }))}>
                    <ProductsContent />
                </PinGate>
            );
            case "sales":
                return currentUser.role === "Funcionário"
                    ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                    : <Sales storeEmail={currentUser.storeEmail} />;
            case "fiado": return <FiadoPage />;
            case "fechamento": return <FechamentoPage storeEmail={currentUser.storeEmail} />;
            case "maintenance": return <Maintenance />;
            case "reports": return (
                <PinGate title="Relatórios protegidos" requiredPin={demoActive ? DEFAULT_PIN : securityPin} unlocked={unlocked.reports}
                    onUnlock={() => setUnlocked(u => ({ ...u, reports: true }))}>
                    <Reports />
                </PinGate>
            );
            case "settings": return <SettingsPage currentPin={securityPin || DEFAULT_PIN} onPinChange={setSecurityPin} />;
            default: return currentUser.role === "Funcionário"
                ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                : <Sales storeEmail={currentUser.storeEmail} />;
        }
    };

    if (authState === "checking") {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-bg">
                <img src={logo} alt="Solucell" className="h-10 w-auto object-contain" />
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
        );
    }

    if (authState === "signed-out") {
        return <LoginPage externalError={authError} onClearError={() => setAuthError("")} defaultEmail={getActiveStore()} />;
    }

    return (
        <StoreDataProvider storeEmail={currentUser.storeEmail}>
            <div className="relative flex w-full min-h-screen bg-bg text-fg-muted font-sans antialiased">

                {/* ================= SIDEBAR (desktop) ================= */}
                <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-nav text-nav-fg z-40">
                    <div className="h-[72px] px-6 flex items-center gap-3 shrink-0">
                        <img src={logo} className="h-8 w-auto object-contain" alt="Solucell" />
                        {demoActive ? (
                            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">Demonstração</span>
                        ) : (
                            <div className="relative">
                                <button onClick={() => setStoreMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={storeMenuOpen} title="Trocar de loja"
                                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/15">
                                    {storeLabel} <ChevronsUpDown className="h-3 w-3 opacity-70" />
                                </button>
                                {storeMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setStoreMenuOpen(false)} />
                                        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 text-fg shadow-[var(--ui-shadow-lg)]">
                                            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">Trocar de loja</p>
                                            {STORES.map(st => (
                                                <button key={st.email} role="menuitem" onClick={() => { setStoreMenuOpen(false); if (st.email !== currentUser.email) switchStore(st.email, currentUser.email); }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover">
                                                    <Store className="h-4 w-4 text-fg-subtle" />
                                                    <span className="flex-1">{st.label}</span>
                                                    {st.email === currentUser.email && <Check className="h-4 w-4 text-primary" />}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="px-4 pb-4">
                        <button
                            onClick={() => setIsNewSaleModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-lg shadow-black/20"
                        >
                            <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
                            Nova operação
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
                        {navSections.map(section => (
                            <div key={section.title}>
                                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">
                                    {section.title}
                                </p>
                                <div className="space-y-1">
                                    {section.items.map(item => {
                                        const Icon = item.icon;
                                        const active = currentPage === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavigation(item.id)}
                                                aria-current={active ? "page" : undefined}
                                                className={`relative w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-colors ${active
                                                    ? "bg-white/[0.08] text-white font-medium"
                                                    : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                                                    }`}
                                            >
                                                <Icon className={`w-[18px] h-[18px] ${active ? "text-white" : "text-white/45"}`} />
                                                <span>{item.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="p-3 border-t border-white/[0.08] shrink-0">
                        <div className="flex items-center gap-3 rounded-xl p-2">
                            <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-sm font-semibold uppercase shrink-0">
                                {userName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white truncate capitalize" title={currentUser.email}>{userName}</p>
                                <p className="text-xs text-white/50 truncate">{currentUser.role}</p>
                            </div>
                            <ThemeToggle className="text-white/60 hover:text-white hover:bg-white/10" />
                            <button
                                onClick={handleLogout}
                                title="Sair"
                                aria-label="Sair"
                                className="flex items-center justify-center w-9 h-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ================= ÁREA PRINCIPAL ================= */}
                <main className="relative flex-1 flex flex-col min-h-screen w-full min-w-0 lg:pl-[264px]">

                    {/* Barra superior (celular/tablet) */}
                    <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-nav text-white pt-[env(safe-area-inset-top)]">
                        <img src={logo} className="h-6 w-auto object-contain" alt="Solucell" />
                        {!demoActive && (
                            <button onClick={() => setMoreOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                                {storeLabel} <ChevronsUpDown className="h-3 w-3 opacity-70" />
                            </button>
                        )}
                        <span className="flex-1" />
                        <ThemeToggle className="text-white/70 hover:bg-white/10" />
                        <button
                            onClick={() => setMoreOpen(true)}
                            className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-sm font-semibold uppercase"
                            aria-label="Conta e menu"
                        >
                            {userName.charAt(0)}
                        </button>
                    </header>

                    {demoActive && (
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-line bg-surface px-4 py-2 text-center text-xs sm:text-sm text-fg-muted">
                            <span className="inline-flex items-center gap-2"><span className="rounded-md border border-warning/25 bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">DEMO</span> Dados fictícios — fique à vontade para testar, nada é salvo de verdade.</span>
                            <button onClick={handleLogout} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-hover">Sair da demo</button>
                        </div>
                    )}

                    <div className="flex-1 w-full max-w-full overflow-x-hidden pb-28 lg:pb-0">
                        <ErrorBoundary key={currentPage} onReset={() => setCurrentPage("sales")}>
                            {renderPage()}
                        </ErrorBoundary>
                    </div>
                </main>

                {/* ================= NAVEGAÇÃO INFERIOR (celular) ================= */}
                <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
                    <div className="relative grid grid-cols-5 h-16">
                        {mobilePrimary.slice(0, 2).map(item => (
                            <MobileTab key={item.id} item={item} active={currentPage === item.id} onClick={() => handleNavigation(item.id)} />
                        ))}
                        <div className="flex items-start justify-center">
                            <button
                                onClick={() => setIsNewSaleModalOpen(true)}
                                className="-mt-5 w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-[var(--ui-shadow-lg)] ring-4 ring-bg active:scale-95 transition-transform"
                                aria-label="Nova operação"
                            >
                                <Plus className="w-6 h-6" strokeWidth={2.5} />
                            </button>
                        </div>
                        {mobilePrimary.slice(2, 3).map(item => (
                            <MobileTab key={item.id} item={item} active={currentPage === item.id} onClick={() => handleNavigation(item.id)} />
                        ))}
                        <MobileTab
                            item={{ id: "more", name: "Mais", icon: Grid2x2 }}
                            active={!currentInPrimary || moreOpen || currentPage === mobilePrimary[3]?.id}
                            onClick={() => setMoreOpen(true)}
                        />
                    </div>
                </nav>

                {/* Folha "Mais" (celular) */}
                {moreOpen && (
                    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
                        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet">
                            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
                            <div className="mb-5 flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full border border-line bg-subtle text-fg-muted flex items-center justify-center font-semibold uppercase">
                                    {userName.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold text-fg capitalize truncate">{userName}</p>
                                    <p className="text-sm text-fg-subtle">{demoActive ? currentUser.role : `Loja ${storeLabel}`}</p>
                                </div>
                                <button onClick={() => setMoreOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-fg-subtle hover:bg-hover" aria-label="Fechar">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {allowedItems.map(item => {
                                    const Icon = item.icon;
                                    const active = currentPage === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleNavigation(item.id)}
                                            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 text-xs font-medium transition-colors ${active ? "border-primary/40 bg-primary-soft text-primary-text" : "border-line text-fg-muted hover:bg-hover"}`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {item.short || item.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {!demoActive && otherStores.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {otherStores.map(st => (
                                        <button key={st.email} onClick={() => switchStore(st.email, currentUser.email)}
                                            className="w-full h-12 rounded-2xl border border-line flex items-center justify-center gap-2 text-sm font-medium text-fg hover:bg-hover">
                                            <Store className="w-4 h-4" /> Trocar para {st.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={handleLogout}
                                className="mt-4 w-full h-12 rounded-2xl border border-line flex items-center justify-center gap-2 text-sm font-medium text-danger hover:bg-danger-soft"
                            >
                                <LogOut className="w-4 h-4" /> {demoActive ? "Sair da demonstração" : "Sair da conta"}
                            </button>
                        </div>
                    </div>
                )}

                {/* MODAL DE NOVA VENDA */}
                {isNewSaleModalOpen && (
                    <NewSaleModal
                        onClose={() => setIsNewSaleModalOpen(false)}
                        storeEmail={currentUser.storeEmail}
                        onSaleComplete={() => setIsNewSaleModalOpen(false)}
                    />
                )}
            </div>
        </StoreDataProvider>
    );
}

function MobileTab({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
    const Icon = item.icon;
    return (
        <button
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-fg-subtle"}`}
        >
            <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.3 : 1.8} />
            {item.short || item.name}
        </button>
    );
}

export default App;
