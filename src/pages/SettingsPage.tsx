// === CONFIGURAÇÕES COMPLETA E ESTILIZADA COM CONFIRMAÇÃO ===

import { useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Lock, UserCheck, Key, AlertTriangle, CheckCircle, X, Settings } from "lucide-react";

// Tipagem
export type TargetSetting = "security_pin" | "vila_password" | "gloria_password";
export type VerificationStep = "idle" | "confirm" | "change"; // Adicionado 'confirm'

// Adicione a interface das props
interface SettingsPageProps {
    currentPin: string;
    onPinChange: (newPin: string) => void;
}


// Receba as props
export default function SettingsPage({ currentPin, onPinChange }: SettingsPageProps) {
    // Inicialize o PIN do estado local com o PIN atual que veio da prop
    const [securityPin, setSecurityPin] = useState(currentPin);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState(""); // necessário p/ reautenticar

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [verification, setVerification] = useState<{
        step: VerificationStep;
        targetSetting: TargetSetting | null;
    }>({ step: "idle", targetSetting: null });

    // Funções de controle do Modal
    const startVerification = (target: TargetSetting) => {
        setError(null);
        setSuccess(null);
        // Limpa campos e inicia o passo de confirmação antes da alteração real
        setSecurityPin(currentPin);
        setNewPassword("");
        setCurrentPassword("");
        setConfirmPassword("");
        setVerification({ step: "confirm", targetSetting: target }); // Inicia no passo 'confirm'
    };

    const confirmAndProceed = () => {
        setError(null);
        setVerification(prev => ({ ...prev, step: "change" })); // Passa para o passo 'change'
    }

    const cancelVerification = () => {
        setVerification({ step: "idle", targetSetting: null });
        setSecurityPin(currentPin);
        setNewPassword("");
        setCurrentPassword("");
        setConfirmPassword("");
        setError(null);
        setSuccess(null);
    };

    // Função para mapear o título do modal
    const getModalTitle = (target: TargetSetting | null) => {
        switch (target) {
            case 'security_pin': return "PIN de Segurança";
            case 'vila_password': return "Senha do Loja Vila";
            case 'gloria_password': return "Senha do Loja Glória";
            default: return "Configuração";
        }
    }


    // === ALTERAR SENHA OU PIN ===
    const changePassword = async () => {
        setError(null);
        setSuccess(null);

        if (!verification.targetSetting) return;

        // === PIN ===
        if (verification.targetSetting === "security_pin") {
            if (securityPin.length !== 4) {
                setError("O PIN deve ter 4 dígitos.");
                return;
            }
            if (securityPin === currentPin) {
                setError("O novo PIN é o mesmo que o atual. Insira um PIN diferente.");
                return;
            }

            // 1. ATUALIZA O ESTADO NO COMPONENTE PAI (App.tsx)
            onPinChange(securityPin);
            // 2. PERSISTE NO LOCALSTORAGE
            localStorage.setItem("app_security_pin", securityPin);

            setSuccess("PIN alterado com sucesso!");
            cancelVerification();
            return;
        }

        // === SENHAS DAS LOJAS ===
        if (!auth.currentUser) {
            setError("Nenhum usuário logado.");
            return;
        }

        // Reautenticacao obrigatória
        try {
            if (currentPassword.length < 3) {
                setError("Informe sua senha atual para confirmar a troca.");
                return;
            }

            const credential = EmailAuthProvider.credential(
                auth.currentUser.email!,
                currentPassword
            );

            await reauthenticateWithCredential(auth.currentUser, credential);
        } catch (e: any) {
            setError("Senha atual incorreta. Tente novamente.");
            return;
        }

        // Validacao nova senha
        if (newPassword.length < 6) {
            setError("A nova senha deve ter no mínimo 6 caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        try {
            await updatePassword(auth.currentUser, newPassword);
            setSuccess("Senha alterada com sucesso!");
            cancelVerification();
        } catch (err: any) {
            setError("Erro ao alterar senha: " + err.message);
        }
    };

    const isChangeDisabled = () => {
        if (verification.targetSetting === "security_pin") {
            // PIN: Deve ter 4 dígitos E ser diferente do atual (currentPin)
            return securityPin.length !== 4 || securityPin === currentPin;
        }
        // SENHAS
        return (
            !currentPassword ||
            newPassword.length < 6 ||
            newPassword !== confirmPassword
        );
    };

    // Renderização das mensagens de status (reutilizável)
    const renderStatusMessage = () => {
        if (success) {
            return (
                <div className="flex items-center gap-2 bg-emerald-600/20 text-emerald-300 p-3 rounded-xl border border-emerald-600 animate-fadeIn">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{success}</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center gap-2 bg-red-600/20 text-red-400 p-3 rounded-xl border border-red-600 animate-shake">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">{error}</span>
                </div>
            );
        }
        return null;
    }

    // Conteúdo do Modal no passo "Confirm"
    const renderConfirmStep = () => {
        const target = verification.targetSetting;
        const isPin = target === 'security_pin';

        return (
            <>
                <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-800/50 rounded-lg">
                    <Lock className="w-10 h-10 text-yellow-400" />
                    <p className="text-lg font-semibold">
                        Confirmação Necessária
                    </p>
                    <p className="text-slate-400 text-sm text-center">
                        Você está prestes a alterar o **{getModalTitle(target)}**.
                        {isPin ? " Confirme para prosseguir com a definição do novo PIN." : " Esta ação exigirá sua senha atual para reautenticação."}
                    </p>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={confirmAndProceed}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        {isPin ? "Prosseguir" : "Continuar para Alteração"}
                    </button>

                    <button
                        onClick={cancelVerification}
                        className="px-4 py-3 bg-slate-300 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </>
        )
    }

    // Conteúdo do Modal no passo "Change" (Onde ocorre a alteração de fato)
    const renderChangeStep = () => {
        const target = verification.targetSetting;
        const isPin = target === 'security_pin';

        return (
            <>
                {error && <div className="mb-4">{renderStatusMessage()}</div>}

                {/* PIN */}
                {isPin && (
                    <div>
                        <label className="block text-sm font-medium mb-2">Novo PIN (4 dígitos)</label>
                        <input
                            type="password"
                            value={securityPin}
                            onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className={`w-full px-4 py-3 rounded-lg text-center text-3xl tracking-[0.6em]
                                outline-none transition-all duration-300 bg-slate-800/60 text-white 
                                border ${securityPin.length === 4 ? "border-emerald-500" : "border-slate-700"}`}
                            maxLength={4}
                            placeholder="••••"
                        />
                    </div>
                )}

                {/* SENHAS */}
                {!isPin && (
                    <>
                        <div>
                            <label className="block text-sm mb-2">Senha atual (Para Reautenticação)</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-700 focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm mb-2">Nova senha (Mínimo 6 caracteres)</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-700 focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm mb-2">Confirmar nova senha</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-700 focus:border-emerald-500"
                            />
                        </div>
                    </>
                )}

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={changePassword}
                        disabled={isChangeDisabled()}
                        className={`flex-1 px-4 py-3 text-white font-semibold rounded-lg transition-colors ${isChangeDisabled() ? "bg-slate-600 opacity-60 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                    >
                        Confirmar Alteração
                    </button>

                    <button
                        onClick={cancelVerification}
                        className="px-4 py-3 bg-slate-300 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </>
        )
    }


    return (
        <div className="p-8 text-slate-900 dark:text-white">
            <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
                Configurações <Settings className="w-6 h-6 text-emerald-500" />
            </h2>
            <p className="text-slate-400 mb-6">Gerencie suas credenciais e PIN de acesso.</p>

            {renderStatusMessage()}
            <div className="h-4"></div>

            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-6 rounded-xl shadow-lg space-y-4">

                <div className="flex justify-between items-center p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-emerald-500" />
                        <div>
                            <p className="font-semibold">PIN de Segurança</p>
                            <p className="text-sm text-slate-500">Usado para proteção das telas. PIN Atual: ****{currentPin.slice(-2)}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => startVerification("security_pin")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                    >
                        Alterar
                    </button>
                </div>

                <hr className="border-slate-200 dark:border-slate-800" />

                {/* Vila */}
                <div className="flex justify-between items-center p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-purple-500" />
                        <p className="font-semibold">Senha do Loja Vila</p>
                    </div>
                    <button
                        onClick={() => startVerification("vila_password")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
                    >
                        Alterar
                    </button>
                </div>

                {/* Glória */}
                <div className="flex justify-between items-center p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-purple-500" />
                        <p className="font-semibold">Senha do Loja Glória</p>
                    </div>
                    <button
                        onClick={() => startVerification("gloria_password")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"

                    >
                        Alterar
                    </button>
                </div>
            </div>

            {/* === MODAL GLOBAL === */}
            {verification.step !== "idle" && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4 relative">

                        <button
                            onClick={cancelVerification}
                            className="absolute top-4 right-4 text-slate-500 hover:text-red-500 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <h3 className="text-2xl font-bold text-center pt-2 mb-4">
                            Alterar {getModalTitle(verification.targetSetting)}
                        </h3>

                        {/* Conteúdo dinâmico do modal */}
                        {verification.step === "confirm" && renderConfirmStep()}
                        {verification.step === "change" && renderChangeStep()}

                    </div>
                </div>
            )}
        </div>
    );
}