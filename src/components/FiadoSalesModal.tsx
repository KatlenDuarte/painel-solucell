import { useState } from "react"
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
    Clock,
    Loader2,
} from "lucide-react"
import { Timestamp } from "firebase/firestore"

// -----------------------------------------------------------
// TIPOS DE DADOS
// -----------------------------------------------------------

interface SaleItem {
    name: string
    qty: number
    price: number
}

interface FiadoSale {
    id: string
    timestamp: Timestamp | string | null
    expectedPaymentDate: Timestamp | string | null
    items: SaleItem[]
    total: number
    status: "pending" | "completed"
    clientName: string
    clientPhone: string
}

interface FiadoScreenProps {
    onGoBack: () => void
    fiadoSales: FiadoSale[]
    // A função é ASYNC, pois precisa salvar no Firebase. Retorna boolean (sucesso/falha)
    onRegisterPayment: (saleId: string, paymentMethod: string) => Promise<boolean>
}

// -----------------------------------------------------------
// COMPONENTE MODAL DE PAGAMENTO
// -----------------------------------------------------------

interface FiadoPaymentModalProps {
    sale: FiadoSale
    onClose: () => void
    onConfirm: (saleId: string, method: string) => Promise<void>
}

function FiadoPaymentModal({ sale, onClose, onConfirm }: FiadoPaymentModalProps) {
    const [isLoading, setIsLoading] = useState(false)

    // Função local que chama o prop onConfirm e gerencia o loading
    const handleConfirmPayment = async (method: string) => {
        setIsLoading(true)
        try {
            await onConfirm(sale.id, method)
        } catch (error) {
            console.error("Erro ao registrar pagamento:", error)
            // Aqui você poderia adicionar um estado de erro para mostrar ao usuário
        } finally {
            // O loading é encerrado, e o modal é fechado (o pai fecha)
            setIsLoading(false)
        }
    }

    // Função para formatar datas (duplicada para manter o componente auto-contido, se for extraído)
    const formatTimestamp = (ts: Timestamp | string | null) => {
        if (!ts) return { date: "N/A", time: "" }

        let d: Date
        if (typeof ts === "string") {
            d = new Date(ts)
        } else if ("toDate" in ts) {
            d = ts.toDate()
        } else {
            d = new Date()
        }

        return {
            date: d.toLocaleDateString("pt-BR"),
            time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
    }

    const expectedDate = formatTimestamp(sale.expectedPaymentDate)

    const paymentMethods = [
        { name: "PIX", icon: Smartphone, color: "text-emerald-400", hover: "hover:border-emerald-500/50", onClick: () => handleConfirmPayment("PIX") },
        { name: "Cartão", icon: CreditCard, color: "text-blue-400", hover: "hover:border-blue-500/50", onClick: () => handleConfirmPayment("Cartão") },
        { name: "Dinheiro", icon: DollarSign, color: "text-amber-400", hover: "hover:border-amber-500/50", onClick: () => handleConfirmPayment("Dinheiro") },
    ]

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className={`bg-slate-900 w-full max-w-md p-8 rounded-2xl border border-slate-700/70 shadow-2xl relative transition-all duration-300 ${isLoading ? 'opacity-80' : 'opacity-100'}`}>
                
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10 rounded-2xl">
                        <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-3" />
                        <p className="text-white font-medium">Processando pagamento...</p>
                    </div>
                )}
                
                <button className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white transition disabled:opacity-50" onClick={onClose} disabled={isLoading}>
                    <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                    <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/30">
                        <Wallet className="w-5 h-5 text-rose-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Registrar Pagamento</h2>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-lg mb-6 border border-slate-700/50">
                    <p className="text-slate-400 mb-1 text-sm">
                        Cliente: <span className="text-white font-medium">{sale.clientName}</span>
                    </p>
                    <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-slate-500" /> Vencimento:{" "}
                        <span className="text-rose-300 font-medium">
                            {expectedDate.date}
                        </span>
                    </p>
                    <div className="mt-3 pt-2 border-t border-slate-700/70">
                        <p className="text-2xl font-bold text-emerald-400">
                            R$ {sale.total.toFixed(2).replace(".", ",")}
                        </p>
                        <p className="text-xs text-slate-500">Valor a ser recebido</p>
                    </div>
                </div>

                <h3 className="text-slate-300 font-semibold mb-3">Escolha o Método de Recebimento:</h3>

                <div className="space-y-3">
                    {paymentMethods.map(method => (
                        <button
                            key={method.name}
                            onClick={method.onClick}
                            disabled={isLoading}
                            className={`w-full bg-slate-800 border border-slate-700 py-3 rounded-xl flex items-center justify-center gap-3 transition-all font-medium shadow-sm shadow-black/20 
                                ${method.hover} ${method.color} ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-700'}`}
                        >
                            <method.icon className="w-5 h-5" /> {method.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

// -----------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------

export default function FiadoScreen({ onGoBack, fiadoSales, onRegisterPayment }: FiadoScreenProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [modalSale, setModalSale] = useState<FiadoSale | null>(null)
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ----------------------------
    // Função para formatar datas
    // ----------------------------
    const formatTimestamp = (ts: Timestamp | string | null) => {
        if (!ts) return { date: "N/A", time: "" }

        let d: Date
        if (typeof ts === "string") {
            d = new Date(ts)
        } else if (ts && "toDate" in ts) {
            d = ts.toDate()
        } else {
            d = new Date() // Fallback
        }

        return {
            date: d.toLocaleDateString("pt-BR"),
            time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
    }

    // ----------------------------
    // Filtrar vendas
    // ----------------------------
    const filteredSales = fiadoSales
        .filter((sale) => sale.status === "pending") // Apenas vendas pendentes aparecem na tela principal
        .filter((sale) => {
            const s = searchTerm.toLowerCase()
            return (
                sale.clientName.toLowerCase().includes(s) ||
                sale.clientPhone.includes(s) ||
                sale.id.includes(s)
            )
        })

    const totalPending = fiadoSales
        .filter((sale) => sale.status === "pending")
        .reduce((sum, sale) => sum + sale.total, 0)

    // ----------------------------
    // Modal
    // ----------------------------
    const openPaymentModal = (sale: FiadoSale) => {
        setError(null); // Limpa erros anteriores
        setModalSale(sale);
    }
    const closeModal = () => setModalSale(null)

    // ----------------------------
    // Confirma Pagamento (Passada para o Modal)
    // ----------------------------
    const handleConfirmPayment = async (saleId: string, method: string) => {
        setIsProcessingPayment(true);
        setError(null);
        try {
            // Chama a função do componente pai para salvar no Firebase
            const success = await onRegisterPayment(saleId, method);

            if (success) {
                // Se a operação Firebase for bem-sucedida, o estado fiadoSales no componente pai
                // será atualizado, e esta tela fará re-render com a venda marcada como 'completed'.
                closeModal();
            } else {
                 // Caso o Firebase retorne false (erro não fatal)
                setError("Ocorreu um erro ao finalizar a venda. Tente novamente.");
            }
        } catch (err) {
            console.error("Erro fatal ao processar pagamento:", err);
            setError("Falha na comunicação com o servidor. Verifique sua conexão.");
        } finally {
            setIsProcessingPayment(false);
        }
    }

    // ----------------------------
    // Render
    // ----------------------------
    return (
        <div className="p-4 sm:p-8 space-y-8 bg-slate-950 min-h-screen">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onGoBack}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition shrink-0"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight">
                            Contas a Receber (Fiado)
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Acompanhe e registre pagamentos das vendas fiadas.
                        </p>
                    </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-md text-right shrink-0 w-full sm:w-auto">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">
                        Total Pendente
                    </p>
                    <p className="text-xl font-bold text-slate-200 mt-0.5">
                        R$ {totalPending.toFixed(2).replace(".", ",")}
                    </p>
                </div>
            </div>

            <hr className="my-6 border-slate-800" />

            {/* BUSCA */}
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
            
            {/* MENSAGEM DE ERRO (GLOBAL) */}
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-center justify-between">
                    <span>Erro: {error}</span>
                    <button onClick={() => setError(null)} className="font-semibold hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* TABELA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-xl">
                <table className="w-full min-w-[850px]">
                    <thead>
                        <tr className="bg-slate-800/80 border-b border-slate-700/50">
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold min-w-[180px]">Cliente / Contato</th>
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold min-w-[250px]">Itens Vendidos</th>
                            <th className="px-6 py-4 text-left text-sm text-slate-300 font-semibold min-w-[180px]">Vencimento Previsto</th>
                            <th className="px-6 py-4 text-right text-sm text-slate-300 font-semibold min-w-[120px]">Valor</th>
                            <th className="px-6 py-4 text-right text-sm text-slate-300 font-semibold min-w-[120px]">Ações</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredSales.length > 0 ? (
                            filteredSales.map((sale, index) => {
                                const saleDate = formatTimestamp(sale.timestamp)
                                const expectedDate = formatTimestamp(sale.expectedPaymentDate)

                                return (
                                    <tr
                                        key={sale.id}
                                        className={`border-b border-slate-800 ${index % 2 ? "bg-slate-900/70" : "bg-slate-900"} hover:bg-slate-800/40 transition`}
                                    >
                                        {/* Cliente */}
                                        <td className="px-6 py-4 align-middle">
                                            <p className="text-white font-medium">{sale.clientName}</p>
                                            <div className="text-slate-400 text-sm flex items-center gap-1.5">
                                                <Smartphone className="w-3 h-3 text-slate-500" /> {sale.clientPhone}
                                            </div>
                                        </td>

                                        {/* Itens */}
                                        <td className="px-6 py-4 text-slate-300 text-sm align-middle max-w-xs truncate">
                                            {sale.items.map((i) => i.name).join(", ")}
                                        </td>

                                        {/* Datas */}
                                        <td className="px-6 py-4 text-sm align-middle">
                                            <span className="flex items-center gap-2 text-rose-300 font-medium">
                                                <Calendar className="w-4 h-4 text-rose-400" />
                                                {expectedDate.date}
                                            </span>
                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Venda: {saleDate.date} {saleDate.time}
                                            </p>
                                        </td>

                                        {/* Valor */}
                                        <td className="px-5 py-4 text-right align-middle">
                                            <p className="text-lg font-bold text-emerald-400">
                                                R$ {sale.total.toFixed(2).replace(".", ",")}
                                            </p>
                                        </td>

                                        {/* Botão */}
                                        <td className="px-6 py-4 text-right align-middle">
                                            <button
                                                onClick={() => openPaymentModal(sale)}
                                                disabled={isProcessingPayment}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md shadow-emerald-500/20 text-sm font-medium transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Wallet className="w-4 h-4" />
                                                Receber
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-10 text-center text-slate-500">
                                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-white text-lg font-medium">Nenhuma dívida encontrada.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {modalSale && (
                <FiadoPaymentModal
                    sale={modalSale}
                    onClose={closeModal}
                    onConfirm={handleConfirmPayment}
                />
            )}
        </div>
    )
}