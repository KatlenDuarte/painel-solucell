import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Smartphone,
  Shield,
  Cable,
  Headphones,
  Edit,
  Trash2,
  Package,
  TriangleAlert,
  AlertCircle,
  DollarSign,
  Layers,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import AddProductModal from "../components/AddProductModal";
import EditStockModal from "../components/EditStockModal";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { fetchProducts, updateProduct, deleteProduct } from "../services/productsService";
import "../index.css";

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  stock: number;
  minStock: number;
  price: number;
  status: "ok" | "low" | "critical";
  store: string;
  barcode?: string | null;
  costPrice?: number | null;
}

type SortField = "name" | "stock" | "price";
type SortDirection = "asc" | "desc";

export default function ProductsContent() {
  const auth = getAuth();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isReplenishmentMode, setIsReplenishmentMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sortField, setSortField] = useState<SortField>("stock");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUserEmail(user ? user.email : null);
    });

    return () => unsubscribe();
  }, [auth]);

  const determineStockStatus = (stock: number, minStock: number): "ok" | "low" | "critical" => {
    if (minStock <= 0) return stock > 0 ? "ok" : "critical";
    if (stock <= 0) return "critical";
    if (stock <= minStock * 0.25) return "critical";
    if (stock < minStock) return "low";
    return "ok";
  };

  const loadProducts = useCallback(async () => {
    if (!userEmail) return;

    setLoading(true);

    try {
      const data = await fetchProducts(userEmail);

      const productsWithStatus: Product[] = data.map((p: any) => {
        const stock = Number(p.stock || 0);
        const minStock = Number(p.minStock || 0);
        const price = Number(p.price || 0);

        return {
          ...p,
          stock,
          minStock,
          price,
          barcode: p.barcode || null,
          costPrice: p.costPrice ?? null,
          status: determineStockStatus(stock, minStock),
        };
      });

      setProducts(productsWithStatus);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) loadProducts();
  }, [userEmail, loadProducts]);

  const handleAddProduct = (newProduct: Product) => {
    const productWithStatus = {
      ...newProduct,
      status: determineStockStatus(newProduct.stock, newProduct.minStock),
    };

    setProducts(prev => [...prev, productWithStatus]);
    setIsAddProductModalOpen(false);
  };

  const handleEditStockClick = (product: Product) => {
    setSelectedProduct(product);
    setIsEditStockModalOpen(true);
  };

  const handleEditStock = async (
    productId: string,
    newStock: number,
    operation: "add" | "remove" | "set",
    newName: string,
    newPrice: number
  ) => {
    if (!selectedProduct) return;

    try {
      const updatedFields: {
        stock: number;
        minStock: number;
        name?: string;
        price?: number;
        nameLower?: string;
      } = {
        stock: Number(newStock),
        minStock: Number(selectedProduct.minStock),
      };

      if (newName.trim() !== selectedProduct.name.trim()) {
        updatedFields.name = newName.trim();
        updatedFields.nameLower = newName.trim().toLowerCase();
      }

      if (newPrice !== selectedProduct.price) {
        updatedFields.price = Number(newPrice);
      }

      await updateProduct(productId, updatedFields);

      setProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? {
                ...p,
                ...updatedFields,
                name: updatedFields.name || p.name,
                price: updatedFields.price !== undefined ? updatedFields.price : p.price,
                status: determineStockStatus(updatedFields.stock, updatedFields.minStock),
              }
            : p
        )
      );

      setSelectedProduct(null);
      setIsEditStockModalOpen(false);
    } catch (err) {
      console.error("Erro ao atualizar produto:", err);
      alert("Erro ao salvar alterações.");
    }
  };

  const handleDeleteProduct = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${name}"?`)) return;

    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("Erro ao excluir produto:", err);
    }
  }, []);

  const toggleReplenishmentMode = () => {
    setIsReplenishmentMode(prev => {
      if (prev) {
        setSelectedCategory("all");
        setSearchTerm("");
      }

      return !prev;
    });
  };

  const baseCategories = [
    { id: "peliculas", name: "Películas", icon: Shield },
    { id: "cases", name: "Cases", icon: Smartphone },
    { id: "cabos", name: "Cabos", icon: Cable },
    { id: "carregadores", name: "Carregadores", icon: Cable },
    { id: "acessorios", name: "Acessórios", icon: Headphones },
    { id: "fone", name: "Fone", icon: Headphones },
    { id: "caixa", name: "Caixa de Som", icon: Headphones },
    { id: "outros", name: "Outros", icon: Package },
  ];

  const categories = [
    { id: "all", name: "Todos", icon: Package, count: products.length },
    ...baseCategories.map(cat => ({
      ...cat,
      count: products.filter(p => p.category === cat.id).length,
    })),
  ];

  const getCategoryName = (id: string) => {
    const category = baseCategories.find(c => c.id === id);
    return category ? category.name : "Outro";
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesReplenishment =
        !isReplenishmentMode ||
        product.status === "low" ||
        product.status === "critical";

      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;

      const term = searchTerm.toLowerCase();

      const matchesSearch =
        product.name.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term) ||
        product.model.toLowerCase().includes(term) ||
        Boolean(product.barcode?.includes(searchTerm));

      return matchesReplenishment && matchesCategory && matchesSearch;
    });

    if (isReplenishmentMode) {
      result = result.sort((a, b) => {
        if (a.status === "critical" && b.status !== "critical") return -1;
        if (a.status !== "critical" && b.status === "critical") return 1;
        return 0;
      });
    }

    return result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (sortField === "name") {
        return sortDirection === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }

      return sortDirection === "asc"
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });
  }, [products, selectedCategory, searchTerm, isReplenishmentMode, sortField, sortDirection]);

  const inventoryStats = useMemo(() => {
    const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
    const totalValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
    const criticalAlerts = products.filter(p => p.status !== "ok").length;

    return { totalItems, totalValue, criticalAlerts };
  }, [products]);

  const exportReplenishmentPDF = () => {
    const productsToExport = filteredProducts.filter(
      product => product.status === "low" || product.status === "critical"
    );

    if (productsToExport.length === 0) {
      alert("Nenhum produto de reposição encontrado com os filtros atuais.");
      return;
    }

    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Reposição de Estoque", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 26);

    doc.text(
      `Categoria: ${
        selectedCategory === "all" ? "Todas as categorias" : getCategoryName(selectedCategory)
      }`,
      14,
      32
    );

    if (searchTerm.trim()) {
      doc.text(`Busca: ${searchTerm}`, 14, 38);
    }

    autoTable(doc, {
      startY: searchTerm.trim() ? 46 : 40,
      head: [["Produto", "Marca", "Modelo", "Categoria", "Estoque", "Mínimo", "Status"]],
      body: productsToExport.map(product => [
        product.name,
        product.brand,
        product.model,
        getCategoryName(product.category),
        `${product.stock} un`,
        `${product.minStock} un`,
        product.status === "critical" ? "Crítico" : "Baixo",
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
      },
    });

    doc.save("reposicao-estoque.pdf");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col gap-3 items-center justify-center text-slate-400 font-sans">
        <div className="h-7 w-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase font-bold tracking-widest text-slate-500">
          Buscando Inventário...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 font-sans antialiased">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isReplenishmentMode ? "REPOSIÇÃO" : "INVENTÁRIO"}
            <span className="text-emerald-500">.</span>
          </h1>

          <p className="text-slate-500 text-xs sm:text-sm flex items-center gap-1.5 mt-1">
            <AlertCircle size={14} className="text-emerald-500" />
            Gere PDF da reposição usando categoria, busca e filtros atuais.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={exportReplenishmentPDF}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-600/20"
          >
            <FileText size={16} />
            PDF Reposição
          </button>

          <button
            onClick={() => setIsAddProductModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 rounded-xl font-black text-slate-950 text-xs uppercase transition-all shadow-lg shadow-emerald-500/10"
          >
            <Plus size={18} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoCard icon={<Layers size={20} />} label="Volume de Itens" value={`${inventoryStats.totalItems} un`} color="blue" />
        <InfoCard icon={<DollarSign size={20} />} label="Valor de Estoque" value={formatCurrency(inventoryStats.totalValue)} color="emerald" />
        <InfoCard icon={<AlertCircle size={20} />} label="Produtos Instáveis" value={`${inventoryStats.criticalAlerts} pendentes`} color="red" />
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl md:rounded-3xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />

            <input
              type="text"
              placeholder="Buscar por nome, marca, modelo ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-xs font-medium focus:border-emerald-500 outline-none placeholder-slate-600 text-white transition-colors"
            />
          </div>

          <button
            onClick={toggleReplenishmentMode}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all border ${
              isReplenishmentMode
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800/50"
            }`}
          >
            <TriangleAlert size={16} />
            {isReplenishmentMode ? "Ver Tudo" : "Filtro Reposição"}
          </button>
        </div>

        <div className="overflow-x-auto pb-1 flex gap-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map(category => {
            const Icon = category.icon;

            return (
              <CategoryBtn
                key={category.id}
                active={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
                icon={<Icon size={14} />}
                label={`${category.name} ${category.count > 0 ? `(${category.count})` : ""}`}
              />
            );
          })}
        </div>

        <div className="flex flex-col xs:flex-row xs:items-center gap-2 pt-3 border-t border-slate-800/60">
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
            Ordenar por:
          </span>

          <div className="flex gap-1.5 flex-wrap">
            <SortButton field="stock" label="Estoque" currentField={sortField} direction={sortDirection} onClick={handleSort} />
            <SortButton field="price" label="Preço" currentField={sortField} direction={sortDirection} onClick={handleSort} />
            <SortButton field="name" label="Nome" currentField={sortField} direction={sortDirection} onClick={handleSort} />
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filteredProducts.length === 0 ? (
            <EmptyState isReplenishmentMode={isReplenishmentMode} />
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm leading-tight">{product.name}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {product.brand} • {product.model}
                    </p>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      {getCategoryName(product.category)}
                    </p>
                  </div>

                  <StatusBadge product={product} />
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">
                      Preço base
                    </span>
                    <span className="font-black text-emerald-400 text-sm">
                      {formatCurrency(product.price)}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleEditStockClick(product)}
                      className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-emerald-400 transition-colors"
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-800">
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Marca / Modelo</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4 text-center">Mínimo</th>
                <th className="px-6 py-4 text-center">Estoque</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/40">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState isReplenishmentMode={isReplenishmentMode} />
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-900/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-white text-sm">{product.name}</td>

                    <td className="px-6 py-4 text-slate-400 text-xs font-medium">
                      {product.brand} <span className="text-slate-600">•</span> {product.model}
                    </td>

                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {getCategoryName(product.category)}
                    </td>

                    <td className="px-6 py-4 text-center text-slate-400 text-sm font-semibold">
                      {product.minStock}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <StatusBadge product={product} />
                    </td>

                    <td className="px-6 py-4 text-right font-black text-emerald-400 text-sm">
                      {formatCurrency(product.price)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditStockClick(product)}
                          className="p-2 hover:bg-emerald-500/10 rounded-xl text-emerald-400 transition-colors"
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSubmit={handleAddProduct}
        storeEmail={userEmail}
      />

      <EditStockModal
        isOpen={isEditStockModalOpen}
        onClose={() => {
          setIsEditStockModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onSubmit={(id, newStock, operation, newName, newPrice) =>
          handleEditStock(id, newStock, operation, newName, newPrice)
        }
      />
    </div>
  );
}

function InfoCard({ icon, label, value, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${colorMap[color]}`}>
        {icon}
      </div>

      <div>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
          {label}
        </p>
        <h4 className="text-xl font-black text-white">
          {value}
        </h4>
      </div>
    </div>
  );
}

function CategoryBtn({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shrink-0 ${
        active
          ? "bg-emerald-500 border-emerald-400 text-slate-950 font-black"
          : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SortButton({ field, label, currentField, direction, onClick }: any) {
  const isActive = currentField === field;

  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all uppercase ${
        isActive
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black"
          : "hover:bg-slate-900 text-slate-400"
      }`}
    >
      {label}
      {isActive && (direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}

function StatusBadge({ product }: { product: Product }) {
  const statusClass =
    product.status === "critical"
      ? "bg-red-500/10 text-red-400 border border-red-500/20"
      : product.status === "low"
      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-black inline-block min-w-[65px] ${statusClass}`}>
      {product.stock} un
    </span>
  );
}

function EmptyState({ isReplenishmentMode }: { isReplenishmentMode: boolean }) {
  return (
    <div className="text-center py-10 bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-500 text-xs font-medium">
      {isReplenishmentMode
        ? "Nenhum produto precisa de reposição no momento."
        : "Nenhum produto encontrado com os filtros atuais."}
    </div>
  );
}