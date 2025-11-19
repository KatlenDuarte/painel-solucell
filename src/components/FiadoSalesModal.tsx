// src/screens/FiadoScreen.tsx

import{ useState } from "react"
import {
    X,
    CheckCircle,
    Wallet,
    Search,
    ArrowLeft,
    Calendar,
    CreditCard,
    DollarSign,
    Smartphone,
} from "lucide-react"

interface SaleItem {
    name: string
    qty: number
    price: number
}

interface FiadoSale {
    id: string
    date: string
    time: string
    items: SaleItem[]
    total: number
    payment: "Fiado"
    status: "pending" | "completed"
    clientName: string
    clientPhone: string
}

interface FiadoScreenProps {
    onGoBack: () => void
    fiadoSales: FiadoSale[]
    onRegisterPayment: (saleId: string, paymentMethod: string) => void
}

export default function FiadoScreen({ onGoBack, fiadoSales, onRegisterPayment }: FiadoScreenProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [modalSale, setModalSale] = useState<FiadoSale | null>(null)

    const filteredSales = fiadoSales.filter(sale => {
        const s = searchTerm.toLowerCase()
        return (
            sale.clientName.toLowerCase().includes(s) ||
            sale.clientPhone.includes(s) ||
            sale.id.includes(s)
        )
    })

    const totalPending = fiadoSales.reduce((sum, sale) => sum + sale.total, 0)

    const openPaymentModal = (sale: FiadoSale) => setModalSale(sale)
    const closeModal = () => setModalSale(null)

    const confirmPayment = (method: string) => {
        if (!modalSale) return
        onRegisterPayment(modalSale.id, method)
        setModalSale(null)
    }

    return (
        <div className="p-8 space-y-8 bg-slate-950 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onGoBack}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>

                    <div>
                        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight">
                            Contas a Receber
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Acompanhe e registre pagamentos das vendas fiadas.
                        </p>
                    </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-md text-right">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">
                        Total Pendente
                    </p>
                    <p className="text-xl font-bold text-slate-200 mt-0.5">
                        R$ {totalPending.toFixed(2).replace('.', ',')}
                    </p>
                </div>
            </div>

            <hr className="my-6 border-slate-800" />

            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar cliente, telefone ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-800/80 border-b border-slate-700/50">
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold">Dívida / Cliente</th>
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold">Itens</th>
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold">Data</th>
                            <th className="px-6 py-4 text-right text-sm text-slate-300 font-semibold">Valor</th>
                            <th className="px-6 py-4 text-right text-sm text-slate-300 font-semibold">Ações</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredSales.map((sale, index) => (
                            <tr
                                key={sale.id}
                                className={`border-b border-slate-800 ${index % 2 ? "bg-slate-900/70" : "bg-slate-900"} hover:bg-slate-800/40 transition`}
                            >
                                <td className="px-6 py-4 align-middle">
                                    <p className="text-white font-medium">{sale.clientName}</p>
                                    <p className="text-slate-400 text-sm">ID: {sale.id} | Tel: {sale.clientPhone}</p>
                                </td>

                                <td className="px-6 py-4 text-slate-300 text-sm align-middle">
                                    {sale.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                                </td>

                                <td className="px-6 py-4 text-sm text-slate-400 align-middle">
                                    <span className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(sale.date).toLocaleDateString("pt-BR")}
                                    </span>
                                </td>

                                <td className="px-5 py-4 text-right align-middle">
                                    <p className="text-1xl font-bold text-emerald-400">
                                        R$ {sale.total.toFixed(2).replace('.', ',')}
                                    </p>
                                </td>

                                <td className="px-6 py-4 text-right align-middle">
                                    <button
                                        onClick={() => openPaymentModal(sale)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md shadow-emerald-500/20 text-sm"
                                    >
                                        <Wallet className="w-4 h-4" />
                                        Receber
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredSales.length === 0 && (
                    <div className="p-10 text-center text-slate-500">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                        <p className="text-white text-lg font-medium">
                            Nenhuma dívida encontrada.
                        </p>
                    </div>
                )}
            </div>

            {modalSale && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-linear-to-br from-slate-900 to-slate-800 w-full max-w-md p-8 rounded-2xl border border-slate-700/70 shadow-2xl relative">
                        <button className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white transition" onClick={closeModal}>
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                            <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/30">
                                <Wallet className="w-5 h-5 text-rose-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                Registrar Pagamento
                            </h2>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-lg mb-6 border border-slate-700/50">
                            <p className="text-slate-400 mb-1 text-sm">
                                Cliente: <span className="text-white font-medium">{modalSale.clientName}</span>
                            </p>
                            <p className="text-slate-400 text-sm">
                                ID Venda: <span className="text-slate-300">{modalSale.id}</span>
                            </p>
                            <div className="mt-3 pt-2 border-t border-slate-700/70">
                                <p className="text-xl font-bold text-emerald-400">
                                    R$ {modalSale.total.toFixed(2).replace(".", ",")}
                                </p>
                                <p className="text-xs text-slate-500">Valor a ser recebido</p>
                            </div>
                        </div>

                        <h3 className="text-slate-300 font-semibold mb-3">Escolha o Método de Recebimento:</h3>

                        <div className="space-y-3">
                            <button
                                onClick={() => confirmPayment("PIX")}
                                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-emerald-400 py-3 rounded-xl flex items-center justify-center gap-3 transition-all font-medium shadow-sm shadow-black/20"
                            >
                                <Smartphone className="w-5 h-5" /> PIX
                            </button>

                            <button
                                onClick={() => confirmPayment("Cartão")}
                                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 text-blue-400 py-3 rounded-xl flex items-center justify-center gap-3 transition-all font-medium shadow-sm shadow-black/20"
                            >
                                <CreditCard className="w-5 h-5" /> Cartão
                            </button>

                            <button
                                onClick={() => confirmPayment("Dinheiro")}
                                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-amber-400 py-3 rounded-xl flex items-center justify-center gap-3 transition-all font-medium shadow-sm shadow-black/20"
                            >
                                <DollarSign className="w-5 h-5" /> Dinheiro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
