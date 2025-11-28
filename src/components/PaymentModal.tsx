import React, { useState } from 'react';
import { DollarSign, X, Loader } from 'lucide-react';

// Use a interface real ou MaintenanceData se for a única que você tem
interface MaintenanceData {
    id: string;
    customer: string;
    value: number;
    device: string;
    model: string;
}

interface PaymentModalProps {
    maintenance: MaintenanceData;
    onClose: () => void;
    // Função para registrar a venda e marcar a manutenção como paga
    onPaymentSubmit: (paymentMethod: string) => Promise<void>; 
}

const PAYMENT_METHODS = [
    { value: "PIX", label: "PIX" }, // 💡 Usando maiúsculas para PIX/CARD/DINHEIRO para consistência com Sales.tsx
    { value: "Cartão", label: "Cartão" },
    { value: "Dinheiro", label: "Dinheiro" },
];

const PaymentModal: React.FC<PaymentModalProps> = ({ maintenance, onClose, onPaymentSubmit }) => {
    // 💡 Configurando o estado inicial com um dos valores permitidos (ex: PIX)
    const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value); 
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Chama a função handlePaymentSubmit que está no MaintenancePage
            await onPaymentSubmit(paymentMethod);
            // O onClose e loadMaintenances serão chamados pelo handleDataUpdate no MaintenancePage
        } catch (error) {
            console.error("Erro no submit do modal:", error);
            // Exibir erro amigável aqui, se necessário
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    disabled={loading}
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-emerald-500" />
                    Registrar Pagamento
                </h2>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg mb-4 border dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Cliente: <strong>{maintenance.customer}</strong></p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Serviço: {maintenance.device} ({maintenance.model})</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">Valor Total: R$ {maintenance.value.toFixed(2).replace('.', ',')}</p>
                </div>


                <form onSubmit={handleSubmit} className="space-y-4">
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Selecione o Método de Pagamento:
                    </label>
                    <select
                        id="paymentMethod"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg bg-white border border-slate-300 dark:bg-slate-700 dark:text-white dark:border-slate-600 focus:ring-emerald-500 focus:border-emerald-500"
                        disabled={loading}
                    >
                        {PAYMENT_METHODS.map((method) => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                        ))}
                    </select>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2 shadow hover:bg-emerald-600 transition disabled:bg-emerald-700 disabled:opacity-70"
                    >
                        {loading ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" /> Processando...
                            </>
                        ) : (
                            <>
                                <DollarSign className="w-5 h-5" /> Confirmar Pagamento e Registrar Venda
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;