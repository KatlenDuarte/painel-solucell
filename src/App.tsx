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
import SettingsPage from "./pages/SettingsPage"; 

interface UserInfo {
  email: string;
  role: string;
}

const VALID_STORES = [
  "vilaesportiva@solucell.com",
  "jardimdagloria@solucell.com",
];

// Função auxiliar para inicializar o PIN (com persistência)
const getInitialPin = () => {
  // Tenta ler do localStorage, se não existir, usa o PIN padrão
  return localStorage.getItem("app_security_pin") || "9838";
};

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  // Inicializa como 'true' (aberto), mas ajustado no useEffect
  const [sidebarOpen, setSidebarOpen] = useState(true); 

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo>({
    email: "",
    role: "",
  });

  // Inicializa o PIN buscando no localStorage
  const [productPin, setProductPin] = useState(getInitialPin); 
  
  const [isProductsUnlocked, setProductsUnlocked] = useState(false);
  const [isReportsUnlocked, setReportsUnlocked] = useState(false);

  // Efeito para definir o estado inicial correto da sidebar e tema
  useEffect(() => {
    document.documentElement.classList.add("dark");
    
    // Define a sidebar como aberta por padrão se for desktop (>= 768px)
    if (window.innerWidth >= 768) { 
        setSidebarOpen(true);
    } else {
        setSidebarOpen(false);
    }
    
    // Listener para ajustar o estado da sidebar ao redimensionar
    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setSidebarOpen(true); // Mantém aberta no desktop
        } else {
            // Não força o fechamento, apenas garante que o estado mobile é considerado
            // se mudar de desktop para mobile
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    
  }, []);

  // Controla navegação e fecha sidebar se for mobile
  const handleNavigation = (pageId: string) => {
    setCurrentPage(pageId);
    if (window.innerWidth < 768) { 
      setSidebarOpen(false);
    }
  };

  // Mantém usuário logado via Firebase
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

  const toggleTheme = () => {
    // Lógica para toggle theme (atualmente não faz nada)
  };

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

  return (
    <div className="bg-slate-100 dark:bg-slate-950 flex w-full min-h-screen">
      {isLoggedIn && (
        <>
          {/* 📱 Overlay Mobile */}
          {sidebarOpen && window.innerWidth < 768 && (
              <div 
                  className="fixed inset-0 bg-black/50 z-40 md:hidden" 
                  onClick={() => setSidebarOpen(false)}
              ></div>
          )}

          <aside
            className={`
              bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 
              transition-transform duration-300 overflow-y-auto flex flex-col h-full z-50
              
              // 🖥️ Desktop (md e acima): Fica estática e visível.
              md:w-64 md:fixed md:translate-x-0
              
              // 📱 Mobile (abaixo de md): Fica fixa, mas escondida se sidebarOpen for falso.
              w-64 fixed top-0 left-0
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            `}
          >
            <div className="p-6">
              <img src={logo} className="w-40 h-auto" />
              <p className="text-slate-700 dark:text-slate-400 text-xs mt-4">
                Painel Solucell
              </p>
            </div>

            <div className="flex-1 px-6">
              <nav className="space-y-2 pb-6">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : "text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div
              className={`p-6 border-t border-slate-300 dark:border-slate-800`}
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
        </>
      )}

      <main
        className={`flex-1 flex flex-col min-h-screen transition-all w-full
            // Desktop (md e acima): Adiciona margem à esquerda e ocupa o restante da tela.
            md:ml-64
        `}
      >
        {isLoggedIn && (
          <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
            
            {/* 🖥️ Oculta o botão de toggle em telas md e maiores */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-700 dark:text-slate-400 md:hidden"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <div className="flex items-center gap-4">
                {/* Título da Página Atual (Visível apenas no Mobile) */}
                <span className="md:hidden text-lg font-semibold text-slate-800 dark:text-white">
                    {navigation.find(item => item.id === currentPage)?.name || 'Painel'}
                </span>

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