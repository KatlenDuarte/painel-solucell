import React, { useEffect, useState, useMemo, useRef } from "react"
import { collection, getDocs, Timestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
    Calendar,
    TrendingUp,
    DollarSign,
    Package,
    ArrowUp,
    ArrowDown,
    Download,
    Store,
    ShoppingCart,
    Clock
} from "lucide-react"

// Função pra formatar moeda (inalterada)
const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Períodos para filtro (inalterado)
const periods = [
    { id: "day", name: "Hoje" },
    { id: "week", name: "Semana" },
    { id: "month", name: "Mês" },
    { id: "year", name: "Ano" }
]

// ⭐️ CORREÇÃO AQUI: Os IDs das lojas foram atualizados para os valores reais do seu campo 'store' no Firebase.
// Substitua "Loja B Nome Real" pelo nome exato da sua segunda loja no Firebase.
const stores = [
    { id: "all", name: "Todas as Lojas" },
    // Use o email como ID, e o nome descritivo para exibição no botão de filtro
    { id: "jardimdagloria@solucell.com", name: "Loja Jardim da Glória" },
    { id: "vilaesportiva@solucell.com", name: "Loja Vila Esportiva" }
    // Adicione outros emails/lojas aqui
]

// Componente Auxiliar para o Cartão de Métrica (inalterado)
interface MetricCardProps {
    icon: React.ReactNode
    title: string
    value: string | number
    growth: number
    iconColor: string
    isMain?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, growth, iconColor, isMain = false }) => {
    const isPositive = growth >= 0
    const growthColor = isPositive ? "text-emerald-400" : "text-red-400"
    const GrowthIcon = isPositive ? ArrowUp : ArrowDown

    const cardClasses = isMain
        ? "bg-emerald-800/30 border-emerald-600/50 col-span-full md:col-span-2 shadow-lg shadow-emerald-900/40 p-5"
        : "bg-slate-800/50 border-slate-700/50 shadow-md shadow-black/20 p-5";

    return (
        <div className={`rounded-xl flex flex-col gap-2 border ${cardClasses} transition-all duration-300 hover:scale-[1.01] hover:shadow-xl`}>
            <div className="flex justify-between items-center">
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${iconColor} p-1.5`}>
                    {icon}
                </div>
                <span className={`text-xs flex items-center gap-1 font-medium ${growthColor} bg-slate-700/50 px-2 py-0.5 rounded-full`}>
                    <GrowthIcon className="w-3 h-3" />
                    {Math.abs(growth).toFixed(1)}%
                </span>
            </div>
            <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</h3>
            <p className={`text-white font-extrabold ${isMain ? "text-2xl" : "text-xl"}`}>
                {value}
            </p>

        </div>
    )
}

// Componente Principal
export default function Reports() {
    const [sales, setSales] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState("month")
    const [storeFilter, setStoreFilter] = useState("all")
    const reportRef = useRef<HTMLDivElement>(null)

    // --- Lógica de Fetching (inalterada) ---
    useEffect(() => {
        async function fetchSales() {
            setLoading(true)
            try {
                const salesSnapshot = await getDocs(collection(db, "sales"))
                const salesData = salesSnapshot.docs.map(doc => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        items: data.items || [],
                        timestamp: data.timestamp,
                        total: Number(data.total) || 0,
                        status: data.status || "active",
                        store: data.store || "unknown",
                    }
                })
                setSales(salesData)
            } catch (error) {
                console.error("Erro ao buscar vendas:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchSales()
    }, [])

    // --- Lógica de Filtro e Cálculo de Métricas (Ajustada) ---
    const getPeriodStart = () => {
        const now = new Date()
        switch (period) {
            case "day":
                return new Date(now.getFullYear(), now.getMonth(), now.getDate())
            case "week": {
                const dayOfWeek = now.getDay()
                const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
                return new Date(now.getFullYear(), now.getMonth(), diff)
            }
            case "month":
                return new Date(now.getFullYear(), now.getMonth(), 1)
            case "year":
                return new Date(now.getFullYear(), 0, 1)
            default:
                return new Date(0)
        }
    }

    const periodStart = getPeriodStart()

    // Função para calcular métricas
    const calculateMetrics = (salesArray: any[]) => {
        const totalRevenue = salesArray.reduce((acc, sale) => acc + sale.total, 0)
        const totalSalesCount = salesArray.length
        const totalItemsSold = salesArray.reduce((acc, sale) =>
            acc + sale.items.reduce((itAcc: number, item: any) => itAcc + (item.saleQty || 0), 0)
            , 0)
        const avgTicket = totalSalesCount ? totalRevenue / totalSalesCount : 0
        return { totalRevenue, totalSalesCount, totalItemsSold, avgTicket }
    }

    // 7. useMemo (Filtro principal de vendas)
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = sale.timestamp?.toDate()
            const isWithinPeriod = saleDate && saleDate >= periodStart
            const isActive = sale.status !== "refunded"
            // ⭐️ Filtra pelo ID REAL (que é o nome da loja no Firebase)
            const isMatchingStore = storeFilter === "all" || sale.store === storeFilter
            return isWithinPeriod && isActive && isMatchingStore
        })
    }, [sales, periodStart, storeFilter])

    // 8. useMemo (Métricas por Loja A e B - AGORA USANDO OS IDs REAIS)
    const { metricsStoreA, metricsStoreB } = useMemo(() => {
        const filterByPeriod = (s: any) => s.timestamp?.toDate() >= periodStart && s.status !== "refunded"

        // ⭐️ Filtra usando os nomes reais do seu Firebase
        const STORE_A_ID = "Jardim da Gloria"
        const STORE_B_ID = "Loja B Nome Real" // Use o nome real da sua Loja B aqui!

        const salesStoreA = sales.filter(s => s.store === STORE_A_ID && filterByPeriod(s))
        const salesStoreB = sales.filter(s => s.store === STORE_B_ID && filterByPeriod(s))

        return {
            metricsStoreA: calculateMetrics(salesStoreA),
            metricsStoreB: calculateMetrics(salesStoreB),
        }
    }, [sales, periodStart])

    const currentMetrics = calculateMetrics(filteredSales);

    // Crescimento simulado
    const growth = ""

    // --- Lógica de Exportação PDF (Inalterada) ---
    const handleExportPDF = async () => {
        if (!reportRef.current) return

        const exportButton = reportRef.current.querySelector('.export-button-hide')
        if (exportButton) exportButton.classList.add('hidden')

        try {
            const canvas = await html2canvas(reportRef.current, { scale: 2 })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const imgProps = pdf.getImageProperties(imgData)

            pdf.setFontSize(16)
            pdf.text("Relatório de Vendas - Solucell", 14, 15)
            pdf.setFontSize(10)
            const periodName = periods.find(p => p.id === period)?.name || "Período"
            const storeName = stores.find(s => s.id === storeFilter)?.name || "Todas as Lojas"
            pdf.text(`Período: ${periodName} | Loja: ${storeName}`, 14, 23)

            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
            pdf.addImage(imgData, "PNG", 5, 28, pdfWidth - 10, pdfHeight * ((pdfWidth - 10) / imgProps.width))
            pdf.save(`Relatorio_Vendas_${storeFilter}_${period}.pdf`)
        } catch (error) {
            console.error("Erro ao exportar PDF:", error)
        } finally {
            if (exportButton) exportButton.classList.remove('hidden')
        }
    }

    // A verificação condicional DEVE vir APÓS TODOS OS HOOKS.
    if (loading) return <p className="text-white p-8">Carregando dados...</p>

    // --- Estrutura da Tela (inalterada) ---
    return (
        <div ref={reportRef} className="p-8 bg-slate-950 min-h-screen space-y-8 font-sans">
            <header className="flex justify-between items-center border-b border-slate-800 pb-5">
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-1">📊 Painel de Vendas Solucell</h1>
                    <p className="text-slate-400 text-sm">Análise de desempenho consolidada por período e loja.</p>
                </div>

                <button
                    onClick={handleExportPDF}
                    className="export-button-hide flex items-center gap-2 px-5 py-2 bg-emerald-600 rounded-full hover:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-700/30 transition-all duration-300"
                >
                    <Download className="w-4 h-4" />
                    Exportar Relatório
                </button>
            </header>

            {/* --- Filtros de Período e Loja --- */}
            <section className="bg-slate-900 p-5 rounded-xl border border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Filtro de Período */}
                    <div>
                        <p className="text-slate-400 mb-2 font-semibold text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> Selecionar Período</p>
                        <div className="flex flex-wrap gap-2">
                            {periods.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setPeriod(p.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === p.id ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                        }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filtro por Loja */}
                    <div>
                        <p className="text-slate-400 mb-2 font-semibold text-sm flex items-center gap-2"><Store className="w-4 h-4" /> Selecionar Loja</p>
                        <div className="flex flex-wrap gap-2">
                            {stores.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setStoreFilter(s.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${storeFilter === s.id ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                        }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* --- Métricas Principais --- */}
            <section>
                <h2 className="text-lg font-semibold text-white mb-4">
                    Resultados:{" "}
                    <span className="text-blue-300">
                        {stores.find(s => s.id === storeFilter)?.name} ({periods.find(p => p.id === period)?.name})
                    </span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">

                    {/* 1. Receita Total (Destaque principal) */}
                    <MetricCard
                        icon={<DollarSign className="w- h-5" />}
                        title="Receita Total"
                        value={formatCurrency(currentMetrics.totalRevenue)}
                        growth={growth}
                        iconColor="bg-emerald-600 text-white"
                        isMain
                    />

                    {/* 3. Itens Vendidos */}
                    <MetricCard
                        icon={<Package className="w-5 h-5" />}
                        title="Vendas"
                        value={currentMetrics.totalItemsSold}
                        growth={growth}
                        iconColor="bg-amber-600 text-white"
                    />

                    {/* 4. Ticket Médio */}
                    <MetricCard
                        icon={<ShoppingCart className="w-5 h-5" />}
                        title="Ticket Médio"
                        value={formatCurrency(currentMetrics.avgTicket)}
                        growth={growth}
                        iconColor="bg-red-600 text-white"
                    />
                </div>
            </section>


            {/* --- Tabela de Detalhes (Vendas Recentes) --- */}
            <section className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl shadow-black/30">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-400" /> Detalhe das Últimas Vendas ({filteredSales.length} Resultados)</h2>
                <div className="overflow-x-auto">
                    {filteredSales.length === 0 ? (
                        <p className="text-slate-400 italic py-3 text-sm">Nenhuma transação encontrada no período e filtro selecionados.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead>
                                <tr className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider bg-slate-800/50">
                                    <th className="py-2 px-3 rounded-tl-lg">Itens Vendidos</th>
                                    <th className="py-2 px-3">Valor Total</th>
                                    <th className="py-2 px-3">Loja</th>
                                    <th className="py-2 px-3 rounded-tr-lg">Data/Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredSales
                                    .slice()
                                    .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                                    .slice(0, 15)
                                    .map(sale => (
                                        <tr key={sale.id} className="text-white hover:bg-slate-800/70 transition-colors">
                                            <td className="py-2 px-3 text-xs font-medium">
                                                {sale.items.map((i: any) => `${i.saleQty}x ${i.name}`).join(", ")}
                                            </td>
                                            <td className="py-2 px-3 text-emerald-400 font-bold text-sm">
                                                {formatCurrency(sale.total)}
                                            </td>
                                            {/* ⭐️ CORREÇÃO AQUI: Mapeia o ID da loja para o Nome da Loja */}
                                            <td className="py-2 px-3 text-slate-300 text-xs">
                                                {stores.find(s => s.id === sale.store)?.name || sale.store || "Desconhecida"}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 text-xs">
                                                {sale.timestamp.toDate().toLocaleString("pt-BR", {
                                                    dateStyle: "short",
                                                    timeStyle: "short"
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    )
}