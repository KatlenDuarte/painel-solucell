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
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import PinValidator from "./components/ProtectedRoute";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import ProductsContent from "./pages/Products";
import LoginPage from "./pages/LoginPage";
import logo from "./logo-solucell.png";

import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Maintenance from "./pages/Maintenance";

interface UserInfo {
  email: string;
  role: string;
}

const VALID_STORES = [
  "vilaesportiva@solucell.com",
  "jardimdagloria@solucell.com",
];

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Dark mode sempre ativo (fixo)
  const [darkMode, setDarkMode] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo>({
    email: "",
    role: "",
  });

  const [productPin] = useState("9838");
  const [isProductsUnlocked, setProductsUnlocked] = useState(false);
  const [isReportsUnlocked, setReportsUnlocked] = useState(false);

  // Manter dark mode fixo ao carregar
  useEffect(() => {
    setDarkMode(true);
    document.documentElement.classList.add("dark");
  }, []);

  // Mantém usuário logado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && VALID_STORES.includes(user.email || "")) {
        setCurrentUser({
          email: user.email || "",
          role: "Administrador",
        });
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Botão de tema não faz mais nada
  const toggleTheme = () => {};

  const handleLogout = () => {
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

  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "products", name: "Produtos", icon: Package },
    { id: "sales", name: "Vendas", icon: ShoppingCart },
    { id: "maintenance", name: "Manutenção", icon: Wrench },
    { id: "reports", name: "Relatórios", icon: BarChart3 },
    { id: "settings", name: "Configurações", icon: Settings },
  ];

  const renderSettingsPage = () => (
    <div className="p-8 text-slate-900 dark:text-white">
      <h2 className="text-3xl font-bold mb-6">Configurações ⚙️</h2>
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-6 rounded-xl shadow-lg text-center">
        <p className="text-lg text-slate-700 dark:text-slate-300">Em breve…</p>
      </div>
    </div>
  );

  const renderPage = () => {
    if (!isLoggedIn)
      return <LoginPage auth={auth} onLoginSuccess={handleLoginSuccess} />;

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
        return renderSettingsPage();

      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-950 flex w-full">
      {isLoggedIn && (
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 transition-all duration-300 overflow-hidden flex flex-col h-full fixed top-0 left-0 z-50`}
        >
          <div className="p-6">
            {sidebarOpen && (
              <>
                <img src={logo} className="w-40 h-auto" />
                <p className="text-slate-700 dark:text-slate-400 text-xs mt-4">
                  Painel Solucell
                </p>
              </>
            )}
          </div>

          <div className="flex-1 px-6">
            <nav className="space-y-2 pb-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    } ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div
            className={`p-6 border-t border-slate-300 dark:border-slate-800 ${
              sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div>
                <p className="text-slate-900 dark:text-white font-medium text-sm">
                  {currentUser.email}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  {currentUser.role}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>
      )}

      <main
        className={`flex-1 flex flex-col min-h-screen transition-all ${
          isLoggedIn && sidebarOpen ? "ml-64" : "ml-0"
        }`}
      >
        {isLoggedIn && (
          <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-700 dark:text-slate-400"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800"
              >
                <Sun className="w-5 h-5 text-white" />
              </button>
            </div>
          </header>
        )}

        <div className="flex-1">{renderPage()}</div>
      </main>
    </div>
  );
}

export default App;
