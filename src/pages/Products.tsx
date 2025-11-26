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
    AlertTriangle,
    // DollarSign, // Removido por não ser usado no escopo
} from "lucide-react";
import AddProductModal from "../components/AddProductModal";
import EditStockModal from "../components/EditStockModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { fetchProducts, addProduct, updateProduct, deleteProduct } from "../services/productsService";
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
}

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

    useEffect(() => {
        if (!userEmail) return;

        const loadProducts = async () => {
            try {
                const data = await fetchProducts(userEmail);

                const productsWithStatus: Product[] = data.map((p: any) => ({
                    ...p,
                    stock: Number(p.stock),
                    minStock: Number(p.minStock),
                    price: Number(p.price),
                    status: determineStockStatus(Number(p.stock), Number(p.minStock))
                }));
                setProducts(productsWithStatus);
            } catch (err) {
                console.error("Erro ao carregar produtos:", err);
            }
        };

        loadProducts();
    }, [userEmail]);

    const handleAddProduct = (newProduct: Product) => {
        const productWithStatus = {
            ...newProduct,
            status: determineStockStatus(newProduct.stock, newProduct.minStock)
        };
        setProducts(prev => [...prev, productWithStatus]);
        setIsAddProductModalOpen(false);
    };

    const handleEditStockClick = (product: Product) => {
        setSelectedProduct(product);
        setIsEditStockModalOpen(true);
    };

    // ✅ FUNÇÃO CORRIGIDA: Recebe newName e newPrice
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

            // ✅ ADICIONA NOME E nameLower SE HOUVE MUDANÇA
            if (newName.trim() !== selectedProduct.name.trim()) {
                updatedFields.name = newName.trim();
                updatedFields.nameLower = newName.trim().toLowerCase();
            }

            // ✅ ADICIONA PREÇO SE HOUVE MUDANÇA
            if (newPrice !== selectedProduct.price) {
                updatedFields.price = newPrice;
            }

            await updateProduct(productId, updatedFields);

            setProducts(prev =>
                prev.map(p =>
                    p.id === productId
                        ? {
                            ...p,
                            ...updatedFields,
                            // Usa o nome e preço do updatedFields, mas garante que a estrutura Product seja mantida
                            name: updatedFields.name || p.name, 
                            price: updatedFields.price !== undefined ? updatedFields.price : p.price,
                            status: determineStockStatus(updatedFields.stock, updatedFields.minStock)
                        }
                        : p
                )
            );

            setSelectedProduct(null);
            setIsEditStockModalOpen(false);
        } catch (err) {
            console.error("Erro ao atualizar produto (estoque/detalhes):", err);
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

    const filteredProducts = useMemo(() => {
        const filtered = products.filter(product => {
            if (isReplenishmentMode) return product.status === "low" || product.status === "critical";

            const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
            const matchesSearch =
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.model.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesCategory && matchesSearch;
        });

        if (isReplenishmentMode) {
            return filtered.sort((a, b) => {
                if (a.status === "critical" && b.status !== "critical") return -1;
                if (a.status !== "critical" && b.status === "critical") return 1;
                return 0;
            });
        }

        return filtered;
    }, [products, isReplenishmentMode, selectedCategory, searchTerm]);

    const {
        replenishmentCount,
        // totalStockValue, // Não usado
        // filteredStockValue, // Não usado
        // lowStockValue, // Não usado
    } = useMemo(() => {
        // O cálculo pode ser simplificado se você não precisar de todos os valores na tela
        const lowStockProducts = products.filter(p => p.status === "low" || p.status === "critical");
        const replenishmentCount = lowStockProducts.length;

        return {
            replenishmentCount,
            totalStockValue: 0,
            filteredStockValue: 0,
            lowStockValue: 0,
        }
    }, [products]);

    const baseCategories = [
        { id: "peliculas", name: "Películas", icon: Shield },
        { id: "cases", name: "Cases", icon: Smartphone },
        { id: "cabos", name: "Cabos", icon: Cable },
        { id: "carregadores", name: "Carregadores", icon: Cable },
        { id: "acessorios", name: "Acessórios", icon: Headphones },
        { id: "fone", name: "Fone", icon: Headphones },
        { id: "caixa", name: "Caixa de Som", icon: Headphones },
        { id: "outros", name: "Outros", icon: Package }
    ];

    const categories = [
        { id: "all", name: "Todos", icon: Package, count: products.length },
        ...baseCategories.map(cat => ({
            ...cat,
            count: products.filter(p => p.category === cat.id).length
        }))
    ];

    const getStockProgressColor = (status: string) => {
        switch (status) {
            case "ok": return "bg-emerald-500";
            case "low": return "bg-amber-500";
            case "critical": return "bg-red-500";
            default: return "bg-slate-500";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ok": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "low": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "ok": return "OK";
            case "low": return "Baixo";
            case "critical": return "Crítico";
            default: return "Sem Status";
        }
    };

    const getCategoryName = (id: string) => {
        const category = baseCategories.find(c => c.id === id);
        return category ? category.name : 'Outro';
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
        
    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen">

            {/* Título e Botão Adicionar */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-2">
                        {isReplenishmentMode ? "Reposição de Estoque" : "Produtos"}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {isReplenishmentMode
                            ? "Visualizando apenas produtos em estado de alerta. Concentre-se no que precisa de atenção."
                            : "Gerencie o catálogo completo de produtos e seus níveis de estoque."
                        }
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Novo Produto
                </button>
            </div>

            {/* Filtro de Categorias*/}
            {!isReplenishmentMode && (
                <div className="flex flex-wrap gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                    {categories.map((category) => {
                        const Icon = category.icon;
                        const isActive = selectedCategory === category.id;
                        return (
                            <button
                                type="button"
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all 
                                    ${isActive
                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {category.name}
                                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-700/50">
                                    {category.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Barra de Ações: Busca e Modo Reposição*/}
            <div className="flex items-center gap-4">
                {!isReplenishmentMode && (
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, marca ou modelo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                        />
                    </div>
                )}

                {/* Botão de Reposição  */}
                <button
                    type="button"
                    onClick={toggleReplenishmentMode}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all font-medium 
                        ${isReplenishmentMode
                            ? "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 flex-1"
                            : "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/30"
                        }`}
                >
                    <AlertTriangle className="w-5 h-5" />
                    {isReplenishmentMode ? (
                        "Ver Catálogo Completo"
                    ) : (
                        <>
                            Reposição Necessária
                            {replenishmentCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white text-red-600 font-bold">
                                    {replenishmentCount}
                                </span>
                            )}
                        </>
                    )}
                </button>
            </div>

            {/* Tabela de Produtos */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-slate-900/50">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-800/80 border-b border-slate-700/50">
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Produto</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Marca</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Categoria</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Modelo</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Estoque</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Preço</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((product, index) => (
                                <tr
                                    key={product.id}
                                    className={`border-b border-slate-800 
                                        ${isReplenishmentMode
                                            ? (product.status === "critical" ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-amber-900/10 hover:bg-amber-900/20')
                                            : (index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/70')
                                        } 
                                        hover:bg-slate-800 transition-all`}
                                >
                                    <td className="px-6 py-4">
                                        <p className="text-white font-medium">{product.name}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-400">{product.brand}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-400">{getCategoryName(product.category)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-400">{product.model}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-white font-medium mb-1">{product.stock} un.</p>
                                        <div className="w-24 bg-slate-700 rounded-full h-1.5">
                                            <div
                                                className={`${getStockProgressColor(product.status)} h-1.5 rounded-full transition-all`}
                                                style={{
                                                    width: `${Math.min(100, (product.stock / product.minStock) * 100)}%`
                                                }}
                                            />
                                        </div>
                                        <p className="text-slate-500 text-xs mt-1">Mín: {product.minStock}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-emerald-400 font-semibold">{formatCurrency(product.price)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}>
                                            {getStatusText(product.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleEditStockClick(product)}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                title="Editar Estoque"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Excluir Produto"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredProducts.length === 0 && (
                    <div className="p-10 text-center text-slate-500">
                        <p>
                            {isReplenishmentMode
                                ? "Nenhum produto precisa de reposição no momento! 🎉 Volte ao catálogo completo para ver todos os itens."
                                : "Nenhum produto encontrado com os filtros atuais ou termo de busca."
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddProductModal
                isOpen={isAddProductModalOpen}
                onClose={() => setIsAddProductModalOpen(false)}
                onSubmit={handleAddProduct}
                storeEmail={userEmail}
            />
            <EditStockModal
                isOpen={isEditStockModalOpen}
                onClose={() => {
                    setIsEditStockModalOpen(false)
                    setSelectedProduct(null)
                }}
                product={selectedProduct}
                // ✅ CHAMADA CORRIGIDA: Agora passa newName e newPrice
                onSubmit={(id, newStock, operation, newName, newPrice) =>
                    handleEditStock(id, newStock, operation, newName, newPrice)
                }
            />
        </div>
    );
}