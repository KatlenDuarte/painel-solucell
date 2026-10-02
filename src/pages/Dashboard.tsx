// src/pages/Dashboard.tsx

import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Zap,
  Users,
  CheckCircle2,
  ChevronRight,
  ShoppingBag
} from "lucide-react";

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

// --- Componente de Cartão de Métrica Otimizado ---
interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, color, subValue, trend = 'neutral' }) => {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  
  const trendBg = isUp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : isDown ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500";
  const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : null;

  const colorMap = {
    emerald: "from-emerald-500/20 to-transparent text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    blue: "from-blue-500/20 to-transparent text-blue-600 dark:text-blue-400 bg-blue-500/10",
    amber: "from-amber-500/20 to-transparent text-amber-600 dark:text-amber-400 bg-amber-500/10",
    red: "from-rose-500/20 to-transparent text-rose-600 dark:text-rose-400 bg-rose-500/10",
    purple: "from-purple-500/20 to-transparent text-purple-600 dark:text-purple-400 bg-purple-500/10",
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/30 dark:hover:shadow-none transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${colorMap[color].split(" ")[0]} opacity-40 rounded-bl-full transition-transform duration-500 group-hover:scale-110`} />
      
      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-1.5">
          <h3 className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
          <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight">{value}</p>
        </div>
        <div className={`w-11 h-11 ${colorMap[color].split(" ").slice(1).join(" ")} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}>
          {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
        </div>
      </div>

      {subValue && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          {TrendIcon && (
            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold ${trendBg}`}>
              <TrendIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="font-medium truncate">{subValue}</span>
        </div>
      )}
    </div>
  );
};

interface DashboardProps {
  storeEmail: string | null;
}

export default function Dashboard({ storeEmail }: DashboardProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeEmail) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const [productsSnapshot, salesSnapshot] = await Promise.all([
          getDocs(query(collection(db, "products"), where("store", "==", storeEmail))),
          getDocs(query(collection(db, "sales"), where("store", "==", storeEmail)))
        ]);

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

        setProducts(productsData);
        setSales(salesData);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [storeEmail]);

  const statsCalculations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const activeSales = sales.filter(sale => sale.status !== "refunded");

    const salesToday = activeSales.filter(sale => sale.timestamp?.toDate() >= today);
    const totalSalesToday = salesToday.reduce((acc, sale) => acc + (sale.total || 0), 0);
    const salesTodayCount = salesToday.length;
    const avgTicketToday = salesTodayCount > 0 ? totalSalesToday / salesTodayCount : 0;

    const salesMonth = activeSales.filter(sale => sale.timestamp?.toDate() >= firstDayOfMonth);
    const totalSalesMonth = salesMonth.reduce((acc, sale) => acc + (sale.total || 0), 0);
    const salesMonthCount = salesMonth.length;

    const totalProductsInStock = products.reduce((acc, p) => acc + p.stock, 0);
    const zeroStockCount = products.filter(p => p.stock === 0).length;
    const lowStockProducts = products.filter(p => p.stock <= p.minStock);

    const pendingFiadoSales = activeSales.filter(sale => sale.isFiado);
    const totalFiadoValue = pendingFiadoSales.reduce((acc, sale) => acc + sale.total, 0);

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
      totalFiadoValue,
    };
  }, [sales, products]);

  if (loading) {
    return (
      <div className="p-8 space-y-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">Processando métricas em tempo real...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* --- Cabeçalho Interno Removido do Grid para Casar com o App.tsx --- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Resumo Operacional</h2>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Indicadores automatizados da filial conectada.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          Sincronizado com Firebase
        </div>
      </div>

      {/* --- Bloco Financeiro --- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard
          title="Faturamento Hoje"
          value={formatCurrency(statsCalculations.totalSalesToday)}
          icon={<DollarSign />}
          color="emerald"
          subValue={`${statsCalculations.salesTodayCount} transações concluídas`}
          trend={statsCalculations.totalSalesToday > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          title="Receita Mensal"
          value={formatCurrency(statsCalculations.totalSalesMonth)}
          icon={<TrendingUp />}
          color="blue"
          subValue={`${statsCalculations.salesMonthCount} ordens este mês`}
          trend="up"
        />
        <MetricCard
          title="Ticket Médio Diário"
          value={formatCurrency(statsCalculations.avgTicketToday)}
          icon={<Zap />}
          color="purple"
          subValue="Média por consumidor hoje"
        />
        <MetricCard
          title="Carteira de Fiados"
          value={formatCurrency(statsCalculations.totalFiadoValue)}
          icon={<CreditCard />}
          color="red"
          subValue={`${statsCalculations.pendingFiadoSales.length} clientes pendentes`}
          trend={statsCalculations.pendingFiadoSales.length > 0 ? 'down' : 'neutral'}
        />
      </section>

      {/* --- Fluxo de Caixa e Atividades --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel Fiados Mobiles Customizados */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Débitos em Aberto</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs">Acompanhamento de inadimplência ativa</p>
              </div>
            </div>
          </div>

          {statsCalculations.pendingFiadoSales.length > 0 ? (
            <div className="flex-1 overflow-y-auto max-h-[340px] space-y-3 pr-1">
              {statsCalculations.pendingFiadoSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{sale.clientName || 'Cliente Identificado'}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {sale.items.map(i => `${i.saleQty}x ${i.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(sale.total)}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fiado</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Sem pendências coletadas!</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[220px] mt-1">Todos os pagamentos a prazo foram liquidados com sucesso.</p>
            </div>
          )}
        </section>

        {/* Últimas Vendas do Dia */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Atividades Recentes</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs">Últimas movimentações de hoje</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[340px] space-y-3 pr-1">
            {statsCalculations.salesToday.slice()
              .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
              .slice(0, 6)
              .map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {sale.items[0]?.name || 'Produto Solucell'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {sale.items.length > 1 ? `e mais ${sale.items.length - 1} produtos inclusos` : 'Item único faturado'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(sale.total)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 hidden sm:block" />
                  </div>
                </div>
              ))}
            {statsCalculations.salesTodayCount === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 dark:text-slate-500">
                <p className="text-sm font-medium">Aguardando a primeira venda...</p>
                <p className="text-xs max-w-[200px] mt-1">Nenhuma transação foi detectada na data de hoje.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* --- Monitor de Estoques Reativo (Design de Barras Remasterizado) --- */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Alertas Críticos</h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs">Rupturas imediatas no catálogo</p>
            </div>
          </div>
          <div className="space-y-4">
            <MetricCard
              title="Produtos Zerados"
              value={statsCalculations.zeroStockCount}
              icon={<Package />}
              color={statsCalculations.zeroStockCount > 0 ? 'red' : 'emerald'}
              subValue={statsCalculations.zeroStockCount > 0 ? 'Risco de perda de vendas na loja' : 'Estoque 100% ativo'}
            />
            <MetricCard
              title="Volumetria Total"
              value={statsCalculations.totalProductsInStock}
              icon={<Package />}
              color="amber"
              subValue={`Grade com ${products.length} variações salvas`}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Atenção à Reposição ({statsCalculations.lowStockProducts.length})</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Itens atingindo ou abaixo da margem de segurança</p>
          </div>

          <div className="overflow-y-auto max-h-[300px] space-y-4 pr-1">
            {statsCalculations.lowStockProducts.length > 0 ? (
              statsCalculations.lowStockProducts.map((item) => {
                const percentage = Math.min((item.stock / (item.minStock || 1)) * 100, 100);
                const isZero = item.stock === 0;

                return (
                  <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                          {item.brand || 'Geral'}
                        </span>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg w-fit ${isZero ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                        {item.stock} unidades em posse
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${isZero ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${isZero ? 100 : percentage}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                        Mín: {item.minStock}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center">
                <p className="text-sm font-medium">Estoque operacional saudável.</p>
                <p className="text-xs mt-0.5">Nenhum produto cruzou a linha de aviso de compra.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}