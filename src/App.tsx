// src/App.tsx

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Wrench,
  Zap,
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import PinValidator from "./components/ProtectedRoute";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import ProductsContent from "./pages/Products";
import LoginPage from "./pages/LoginPage";
import Maintenance from "./pages/Maintenance";
import SettingsPage from "./pages/SettingsPage";

import logo from "./logo-solucell.png";

import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface UserInfo {
  email: string;
  role: string;
}

const VALID_STORES = [
  "vilaesportiva@solucell.com",
  "jardimdagloria@solucell.com",
  "teste@solucell.com", // Adicionado email de teste
];

const DEFAULT_PIN = "9838";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [pinLoading, setPinLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<UserInfo>({
    email: "",
    role: "",
  });

  const [productPin, setProductPin] = useState(DEFAULT_PIN);
  const [isProductsUnlocked, setProductsUnlocked] = useState(false);
  const [isReportsUnlocked, setReportsUnlocked] = useState(false);

  useEffect(() => {
    const loadGlobalPin = async () => {
      try {
        const ref = doc(db, "settings", "security");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setProductPin(data.pin || DEFAULT_PIN);
        } else {
          await setDoc(ref, {
            pin: DEFAULT_PIN,
            updatedAt: new Date(),
          });
          setProductPin(DEFAULT_PIN);
        }
      } catch (error) {
        console.error("Erro ao carregar PIN global:", error);
        setProductPin(DEFAULT_PIN);
      } finally {
        setPinLoading(false);
      }
    };

    loadGlobalPin();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && VALID_STORES.includes(user.email || "")) {
        setCurrentUser({
          email: user.email || "",
          role: "Administrador",
        });
        setIsLoggedIn(true);
      } else if (!isLoggedIn) {
        setIsLoggedIn(false);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleNavigation = (pageId: string) => {
    setCurrentPage(pageId);

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLogout = () => {
    auth.signOut();
    setCurrentUser({ email: "", role: "" });
    setIsLoggedIn(false);
    setProductsUnlocked(false);
    setReportsUnlocked(false);
    setCurrentPage("dashboard");
  };

  const handleLoginSuccess = (storeEmail: string) => {
    setCurrentUser({
      email: storeEmail,
      role: "Administrador",
    });

    setIsLoggedIn(true);
  };

  const handleQuickTestLogin = () => {
    // Entra direto como conta neutra de teste sem carregar dados reais
    handleLoginSuccess("teste@solucell.com");
  };

  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "products", name: "Produtos", icon: Package },
    { id: "sales", name: "Vendas", icon: ShoppingCart },
    { id: "maintenance", name: "Manutenção", icon: Wrench },
    { id: "reports", name: "Relatórios", icon: BarChart3 },
    { id: "settings", name: "Configurações", icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard storeEmail={currentUser.email} />;

      case "products":
        return (
          <PinValidator
            isUnlocked={isProductsUnlocked}
            onUnlock={setProductsUnlocked}
            requiredPin={productPin}
          >
            <ProductsContent />
          </PinValidator>
        );

      case "sales":
        return <Sales storeEmail={currentUser.email} />;

      case "maintenance":
        return <Maintenance />;

      case "reports":
        return (
          <PinValidator
            isUnlocked={isReportsUnlocked}
            onUnlock={setReportsUnlocked}
            requiredPin={productPin}
            storeEmail={currentUser.email}
          >
            <Reports storeEmail={currentUser.email} />
          </PinValidator>
        );

      case "settings":
        return (
          <SettingsPage
            currentPin={productPin}
            onPinChange={setProductPin}
          />
        );

      default:
        return null;
    }
  };

  if (authLoading || pinLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Carregando painel...
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased relative">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onClick={handleQuickTestLogin}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            Entrar em Modo Demonstração
          </button>

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-all"
            aria-label="Alternar tema"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        <LoginPage auth={auth} onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex w-full min-h-screen font-sans antialiased selection:bg-emerald-500/30">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 
          transition-all duration-300 ease-in-out overflow-y-auto flex flex-col h-screen z-50
          fixed top-0 left-0 w-64
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="p-6 flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center justify-between">
            <img
              src={logo}
              alt="Solucell Logo"
              className="w-32 h-auto object-contain"
            />

            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[10px] tracking-wider uppercase font-semibold text-slate-400 dark:text-slate-500 mt-2">
            Painel Administrativo
          </p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "scale-110" : ""}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col gap-3">
            <div className="px-2">
              <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm truncate">
                {currentUser.email.split("@")[0]}
              </p>

              <p className="text-slate-400 dark:text-slate-500 text-xs truncate">
                {currentUser.email}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da Conta
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen transition-all duration-300 w-full md:ml-64">
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl md:hidden transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white capitalize">
              {navigation.find((item) => item.id === currentPage)?.name ||
                "Painel"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all duration-200"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;