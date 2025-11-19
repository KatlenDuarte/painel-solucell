import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
    TrendingUp,
    DollarSign,
    Package,
    AlertTriangle,
    ArrowUp,
    ArrowDown,
    CreditCard,
    Zap,
    Users
} from "lucide-react";

// --- Interfaces ---
interface Product {
    id: string;
    name: string;
    brand: string;
    model: string;
    stock: number;
    minStock: number;
    store: string;
}

interface SaleItem {
    id: string;
    name: string;
    price: number;
    saleQty: number;
    paymentMethod: string;
    status: string;
    subtotal: number;
    store: string;
}

interface Sale {
    id: string;
    clientName: string;
    clientPhone: string;
    discount: number;
    isFiado: boolean;
    items: SaleItem[];
    timestamp: Timestamp;
    total: number;
    store: string;
    status: string;
}

function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

// --- Componente Reutilizável de Cartão de Métrica ---
interface MetricCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
    subValue?: string;
    trend?: 'up' | 'down' | 'neutral';

}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, color, subValue, trend = 'neutral' }) => {
    const trendColor = trend === 'up' ? "text-emerald-400" : trend === 'down' ? "text-red-400" : "text-slate-400";
    const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : null;

    const iconClasses = {
        emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
        blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
        amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
        red: { bg: "bg-red-500/10", text: "text-red-500" },
        purple: { bg: "bg-purple-500/10", text: "text-purple-500" },
    }[color];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-md">
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">{title}</h3>
                    <p className="text-white text-2xl font-bold">{value}</p>
                </div>
                <div className={`w-10 h-10 ${iconClasses.bg} rounded-lg flex items-center justify-center shrink-0`}>
                    {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${iconClasses.text}` })}
                </div>
            </div>

            {subValue && (
                <div className="mt-3 text-sm flex items-center gap-2">
                    {TrendIcon && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
                    <span className={`${trendColor} font-medium`}>{subValue}</span>
                </div>
            )}
        </div>
    );
};


// --- Componente Principal Dashboard ---
interface DashboardProps {
    storeEmail: string | null;
}

export default function Dashboard({ storeEmail }: DashboardProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!storeEmail) {
            console.error("storeEmail é nulo. Dados não serão carregados.");
            setLoading(false);
            return;
        }

        async function fetchData() {
            setLoading(true);
            try {
                // Products Query
                const productsQuery = query(
                    collection(db, "products"),
                    where("store", "==", storeEmail)
                );
                const productsSnapshot = await getDocs(productsQuery);
                const productsData = productsSnapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: data.id || doc.id,
                        name: data.name,
                        brand: data.brand,
                        model: data.model,
                        stock: Number(data.stock) || 0,
                        minStock: Number(data.minStock) || 0,
                        store: data.store,
                    };
                });

                // Sales Query
                const salesQuery = query(
                    collection(db, "sales"),
                    where("store", "==", storeEmail)
                );
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        clientName: data.clientName,
                        clientPhone: data.clientPhone,
                        discount: data.discount,
                        isFiado: data.isFiado || false,
                        items: data.items || [],
                        timestamp: data.timestamp,
                        total: Number(data.total) || 0,
                        store: data.store,
                        status: data.status || "active",
                    };
                });

                setProducts(productsData as Product[]);
                setSales(salesData as Sale[]);
            } catch (error) {
                console.error("Erro ao buscar dados:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [storeEmail]);


    const {
        totalSalesToday,
        totalSalesMonth,
        salesTodayCount,
        salesMonthCount,
        totalProductsInStock,
        zeroStockCount,
        lowStockProducts,
        pendingFiadoSales,
        avgTicketToday,
        salesToday,
    } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Vendas ativas (não reembolsadas)
        const activeSales = sales.filter(sale => sale.status !== "refunded");

        // Vendas do dia
        const salesToday = activeSales.filter(
            (sale) => sale.timestamp?.toDate() >= today
        );
        const totalSalesToday = salesToday.reduce((acc, sale) => acc + (sale.total || 0), 0);
        const salesTodayCount = salesToday.length;
        const avgTicketToday = salesTodayCount > 0 ? totalSalesToday / salesTodayCount : 0;

        // Vendas do mês
        const salesMonth = activeSales.filter(
            (sale) => sale.timestamp?.toDate() >= firstDayOfMonth
        );
        const totalSalesMonth = salesMonth.reduce((acc, sale) => acc + (sale.total || 0), 0);
        const salesMonthCount = salesMonth.length;

        // Estoque
        const totalProductsInStock = products.reduce((acc, p) => acc + p.stock, 0);
        const zeroStockCount = products.filter((p) => p.stock === 0).length;
        // Inclui produtos com estoque zero (stock <= minStock)
        const lowStockProducts = products.filter(
            (product) => product.stock <= product.minStock
        );

        // Vendas Fiadas Pendentes
        const pendingFiadoSales = activeSales.filter(
            (sale) => sale.isFiado
        );

        return {
            totalSalesToday,
            totalSalesMonth,
            salesTodayCount,
            salesMonthCount,
            totalProductsInStock,
            zeroStockCount,
            lowStockProducts,
            pendingFiadoSales,
            avgTicketToday,
            salesToday,
        };
    }, [sales, products]);

    const stats = [
        {
            title: "Receita Hoje",
            value: formatCurrency(totalSalesToday),
            icon: <DollarSign />,
            color: "emerald",
            subValue: `${salesTodayCount} vendas`
        },
        {
            title: "Vendas do Mês",
            value: formatCurrency(totalSalesMonth),
            icon: <TrendingUp />,
            color: "blue",
            subValue: `${salesMonthCount} pedidos`
        },
        {
            title: "Ticket Médio (Hoje)",
            value: formatCurrency(avgTicketToday),
            icon: <Zap />,
            color: "purple",
            subValue: 'Baseado nas vendas de hoje',
            trend: 'up' as const
        },
        {
            title: "Fiado Pendente",
            value: pendingFiadoSales.length.toString(),
            icon: <CreditCard />,
            color: "red",
            subValue: pendingFiadoSales.length > 0 ? 'Exige atenção' : 'Tudo liquidado!',
            trend: pendingFiadoSales.length > 0 ? 'down' as const : 'up' as const
        },
    ];

    // --- Renderização ---
    if (loading) return <p className="text-white p-8">Carregando dados...</p>;

    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen font-sans">
            <header className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white mb-1">Painel da Loja</h1>
                <p className="text-slate-400 text-sm">Visão geral e estoque da sua loja</p>
            </header>

            {/* --- Seção de Métricas (Cartões de Destaque) --- */}
            <section>
                <h2 className="text-lg font-semibold text-white mb-4">Desempenho Financeiro</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat) => (
                        <MetricCard
                            key={stat.title}
                            title={stat.title}
                            value={stat.value}
                            icon={stat.icon}
                            color={stat.color as 'emerald' | 'blue' | 'amber' | 'red' | 'purple'}
                            subValue={stat.subValue}
                            trend={stat.trend}
                        />
                    ))}
                </div>
            </section>

            {/* --- Seção de Vendas Recentes e Fiado --- */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Fiado Pendente (Tabela) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-500" /> Fiado / Pagamentos Pendentes ({pendingFiadoSales.length})</h2>
                    </div>

                    {pendingFiadoSales.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-800">
                                <thead>
                                    <tr className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider bg-slate-800/50">
                                        <th className="py-2 px-3">Cliente</th>
                                        <th className="py-2 px-3">Itens</th>
                                        <th className="py-2 px-3 text-right">Valor Devido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {pendingFiadoSales.map((sale) => (
                                        <tr key={sale.id} className="text-white hover:bg-slate-800/70 transition-colors">
                                            <td className="py-2 px-3 text-sm font-medium flex items-center gap-2">
                                                <Users className="w-4 h-4 text-slate-500" />{sale.clientName || 'Cliente sem nome'}
                                            </td>
                                            <td className="py-2 px-3 text-xs text-slate-400">
                                                {sale.items.map(item => item.name).join(', ')}
                                            </td>
                                            <td className="py-2 px-3 text-right text-red-400 font-bold text-sm">
                                                {formatCurrency(sale.total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-slate-400">Nenhuma venda fiada ou pendente encontrada. 🎉</p>
                    )}
                </div>

                {/* 2. Vendas Recentes */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-white">Vendas Recentes (Hoje)</h2>
                    </div>
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {salesToday.slice()
                            .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                            .slice(0, 5)
                            .map((sale) => {
                                return (
                                    <div
                                        key={sale.id}
                                        className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-all"
                                    >
                                        <div className="flex-1">
                                            <p className="text-white font-medium text-sm">
                                                {/* ⭐️ APENAS O NOME DO PRODUTO/ITENS */}
                                                {sale.items[0]?.name} {sale.items.length > 1 ? ` (+${sale.items.length - 1} itens)` : ''}
                                            </p>
                                        </div>
                                        <span className="text-emerald-400 font-semibold text-base shrink-0">
                                            {formatCurrency(sale.total)}
                                        </span>
                                    </div>
                                );
                            })}
                        {salesTodayCount === 0 && <p className="text-slate-400 py-4">Nenhuma venda realizada hoje.</p>}
                    </div>
                </div>
            </section>

            {/* --- Seção de Estoque --- */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Alertas de Estoque Zerado */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-1 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                        <h2 className="text-lg font-semibold text-white">Alertas de Estoque</h2>
                    </div>
                    <div className="space-y-4">
                        <MetricCard
                            title="Produtos Zerados"
                            value={zeroStockCount.toString()}
                            icon={<Package />}
                            color={zeroStockCount > 0 ? 'red' : 'emerald'}
                            subValue={zeroStockCount > 0 ? 'Estoque precisa de reposição imediata' : 'Nenhum item zerado'}
                        />
                        <MetricCard
                            title="Total em Estoque"
                            value={totalProductsInStock.toString()}
                            icon={<Package />}
                            color={'amber'}
                            subValue={`(${products.length} itens distintos)`}
                        />
                    </div>
                </div>

                {/* 2. Produtos com Estoque Baixo (Detalhamento) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <h2 className="text-lg font-semibold text-white">Estoque Baixo ({lowStockProducts.length})</h2>
                    </div>
                    <div className="space-y-4 max-h-86 overflow-y-auto pr-2">
                        {lowStockProducts.length > 0 ? (
                            lowStockProducts.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-4 bg-slate-800/50 rounded-lg border border-red-500/20 hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-white font-medium">{item.name}</p>
                                        <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                                            {item.brand}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                                            <div
                                                className="bg-red-500 h-2 rounded-full"
                                                style={{ width: `${(item.stock / item.minStock) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-red-400 text-sm font-medium shrink-0">
                                            {item.stock} / {item.minStock} (Min.)
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 py-4 text-sm">Nenhum produto está abaixo do estoque mínimo definido.</p>
                        )}
                    </div>
                </div>
            </section>

        </div>
    );
}