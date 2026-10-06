// === CONFIGURAÇÕES COMPLETA E ESTILIZADA COM CONFIRMAÇÃO ===

import { useState } from "react";
import type React from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc } from "../lib/firestore";
import { Lock, Key, AlertTriangle, CheckCircle, X, Palette, Sun, Moon, Shield } from "lucide-react";
import { Page, PageHeader, Card, CardHeader, Button, IconButton } from "../components/ui";
import { useTheme } from "../contexts/ThemeContext";
import { isDemoMode } from "../lib/demoMode";

// Tipagem
export type TargetSetting = "security_pin" | "store_password";
export type VerificationStep = "idle" | "confirm" | "change";

// Adicione a interface das props
interface SettingsPageProps {
    currentPin: string;
    onPinChange: (newPin: string) => void;
}

// Receba as props
export default function SettingsPage({ currentPin, onPinChange }: SettingsPageProps) {
    const { theme, setTheme } = useTheme();
    // Inicialize o PIN do estado local com o PIN atual (ou fallback seguro "0000")
    const [securityPin, setSecurityPin] = useState<string>(currentPin || "0000");
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
        if (isDemoMode()) {
            setError("Alteração de PIN e senha não está disponível no modo demonstração.");
            return;
        }
        setSuccess(null);
        // Limpa campos e inicia o passo de confirmação antes da alteração real
        setSecurityPin(currentPin || "0000");
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
        setSecurityPin(currentPin || "0000");
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
            case 'store_password': return "Senha de acesso da Loja"; // Título unificado
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

            // Salva no Firestore (settings/security), o mesmo PIN usado por todas as lojas
            try {
                await setDoc(doc(db, "settings", "security"), { pin: securityPin, updatedAt: new Date() }, { merge: true });
            } catch (e) {
                if ((e as { code?: string })?.code !== "permission-denied") {
                    console.error(e);
                    setError("Não foi possível salvar o PIN. Verifique a conexão e tente novamente.");
                    return;
                }
                // Firebase sem permissão em "settings": guarda o PIN só neste navegador
                try { localStorage.setItem("solucell-pin", securityPin); } catch { /* sem armazenamento */ }
            }
            onPinChange(securityPin);

            setSuccess("PIN alterado com sucesso!");
            cancelVerification();
            return;
        }

        // === SENHA DE ACESSO DA LOJA (Firebase) ===
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
                <div className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm font-medium text-success">
                    <CheckCircle className="h-4 w-4" /> {success}
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    <AlertTriangle className="h-4 w-4" /> {error}
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
                <div className="p-5">
                    <div className="flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            Você está prestes a alterar o <strong>{getModalTitle(target)}</strong>.
                            {isPin ? " Confirme para definir um novo PIN." : " Será necessário informar a senha atual."}
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
                    <Button onClick={cancelVerification}>Cancelar</Button>
                    <Button variant="primary" onClick={confirmAndProceed}>{isPin ? "Prosseguir" : "Continuar"}</Button>
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
                <div className="space-y-4 p-5">
                    {error && renderStatusMessage()}

                    {isPin && (
                        <div>
                            <label className="ui-label">Novo PIN (4 dígitos)</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                value={securityPin}
                                onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                className={`ui-input h-14 text-center text-2xl tracking-[0.6em] ${securityPin.length === 4 ? "!border-success" : ""}`}
                                maxLength={4}
                                placeholder="••••"
                            />
                        </div>
                    )}

                    {!isPin && (
                        <>
                            <div>
                                <label className="ui-label">Senha atual</label>
                                <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="ui-input" />
                            </div>
                            <div>
                                <label className="ui-label">Nova senha</label>
                                <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="ui-input" />
                                <p className="mt-1 text-xs text-fg-subtle">Mínimo de 6 caracteres.</p>
                            </div>
                            <div>
                                <label className="ui-label">Confirmar nova senha</label>
                                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="ui-input" />
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className="mt-1 text-xs text-danger">As senhas não coincidem.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
                    <Button onClick={cancelVerification}>Cancelar</Button>
                    <Button variant="primary" onClick={changePassword} disabled={isChangeDisabled()}>Salvar alteração</Button>
                </div>
            </>
        )
    }

    const SettingRow = ({ icon: Icon, title, description, action }: { icon: typeof Lock; title: string; description: string; action: React.ReactNode }) => (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-fg-subtle">
                    <Icon className="h-4 w-4" />
                </span>
                <div>
                    <p className="text-sm font-medium text-fg">{title}</p>
                    <p className="text-sm text-fg-subtle">{description}</p>
                </div>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );

    return (
        <Page narrow>
            <PageHeader title="Configurações" description="Segurança da conta e preferências do painel." />

            {renderStatusMessage()}

            <Card padded={false}>
                <CardHeader title="Segurança" description="Credenciais de acesso ao painel" icon={Shield} />
                <div className="divide-y divide-line">
                    {SettingRow({
                        icon: Lock,
                        title: "PIN de segurança",
                        description: "Protege telas sensíveis com um código de 4 dígitos.",
                        action: <Button onClick={() => startVerification("security_pin")}>Alterar PIN</Button>,
                    })}
                    {SettingRow({
                        icon: Key,
                        title: "Senha do painel",
                        description: "Senha usada para entrar no sistema da loja.",
                        action: <Button onClick={() => startVerification("store_password")}>Alterar senha</Button>,
                    })}
                </div>
            </Card>

            <Card padded={false}>
                <CardHeader title="Aparência" description="A preferência fica salva neste navegador" icon={Palette} />
                <div className="grid max-w-lg grid-cols-2 gap-3 p-5">
                    {([
                        { id: "light", label: "Claro", icon: Sun },
                        { id: "dark", label: "Escuro", icon: Moon },
                    ] as const).map(option => {
                        const Icon = option.icon;
                        const active = theme === option.id;
                        return (
                            <button
                                key={option.id}
                                onClick={() => setTheme(option.id)}
                                className={`overflow-hidden rounded-xl border text-left transition-colors ${active ? "border-primary ring-3 ring-primary/15" : "border-line hover:border-line-strong"}`}
                            >
                                <div className={`flex h-20 gap-1.5 p-2.5 ${option.id === "dark" ? "bg-[#0c0d10]" : "bg-[#f5f6f8]"}`}>
                                    <div className={`w-1/4 rounded-md ${option.id === "dark" ? "bg-[#14161a]" : "bg-white"}`} />
                                    <div className="flex flex-1 flex-col gap-1.5">
                                        <div className={`h-3 w-2/3 rounded ${option.id === "dark" ? "bg-[#25282f]" : "bg-[#e6e8eb]"}`} />
                                        <div className={`flex-1 rounded-md ${option.id === "dark" ? "bg-[#14161a]" : "bg-white"}`} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-medium text-fg">
                                    <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-fg-subtle"}`} />
                                    {option.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* === MODAL === */}
            {verification.step !== "idle" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={cancelVerification}>
                    <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-fg">Alterar {getModalTitle(verification.targetSetting)}</h3>
                            <IconButton icon={X} label="Fechar" onClick={cancelVerification} />
                        </div>
                        {verification.step === "confirm" && renderConfirmStep()}
                        {verification.step === "change" && renderChangeStep()}
                    </div>
                </div>
            )}
        </Page>
    );
}
