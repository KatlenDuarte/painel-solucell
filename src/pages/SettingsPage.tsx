// src/pages/SettingsPage.tsx

import { useState } from "react";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

import {
  Lock,
  Key,
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  ShieldCheck,
  Store,
  ChevronRight,
} from "lucide-react";

export type TargetSetting =
  | "security_pin"
  | "vila_password"
  | "gloria_password";

export type VerificationStep = "idle" | "confirm" | "change";

interface SettingsPageProps {
  currentPin: string;
  onPinChange: (newPin: string) => void;
}

export default function SettingsPage({
  currentPin,
  onPinChange,
}: SettingsPageProps) {
  const [securityPin, setSecurityPin] = useState(currentPin);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [verification, setVerification] = useState<{
    step: VerificationStep;
    targetSetting: TargetSetting | null;
  }>({
    step: "idle",
    targetSetting: null,
  });

  const startVerification = (target: TargetSetting) => {
    setError(null);
    setSuccess(null);
    setSecurityPin(currentPin);
    setNewPassword("");
    setCurrentPassword("");
    setConfirmPassword("");
    setVerification({ step: "confirm", targetSetting: target });
  };

  const confirmAndProceed = () => {
    setError(null);
    setVerification((prev) => ({ ...prev, step: "change" }));
  };

  const cancelVerification = () => {
    setVerification({ step: "idle", targetSetting: null });
    setSecurityPin(currentPin);
    setNewPassword("");
    setCurrentPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const getModalTitle = (target: TargetSetting | null) => {
    switch (target) {
      case "security_pin":
        return "PIN Global";
      case "vila_password":
        return "Senha Loja Vila";
      case "gloria_password":
        return "Senha Loja Glória";
      default:
        return "Configuração";
    }
  };

  const changePassword = async () => {
    setError(null);
    setSuccess(null);

    if (!verification.targetSetting) return;

    if (verification.targetSetting === "security_pin") {
      if (securityPin.length !== 4) {
        setError("O PIN deve ter 4 dígitos.");
        return;
      }

      if (securityPin === currentPin) {
        setError("O novo PIN é o mesmo que o atual.");
        return;
      }

      try {
        await setDoc(
          doc(db, "settings", "security"),
          {
            pin: securityPin,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        onPinChange(securityPin);
        setSuccess("PIN global alterado com sucesso.");
        setVerification({ step: "idle", targetSetting: null });
      } catch (error) {
        console.error("Erro ao salvar PIN global:", error);
        setError("Erro ao salvar PIN global.");
      }

      return;
    }

    if (!auth.currentUser) {
      setError("Nenhum usuário logado.");
      return;
    }

    try {
      if (currentPassword.length < 3) {
        setError("Informe sua senha atual para confirmar.");
        return;
      }

      const credential = EmailAuthProvider.credential(
        auth.currentUser.email!,
        currentPassword
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch {
      setError("Senha atual incorreta.");
      return;
    }

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

      setSuccess("Senha alterada com sucesso.");
      setVerification({ step: "idle", targetSetting: null });
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    } catch (err: any) {
      setError("Erro ao alterar senha: " + err.message);
    }
  };

  const isChangeDisabled = () => {
    if (verification.targetSetting === "security_pin") {
      return securityPin.length !== 4 || securityPin === currentPin;
    }

    return (
      !currentPassword ||
      newPassword.length < 6 ||
      newPassword !== confirmPassword
    );
  };

  const renderStatusMessage = () => {
    if (success) {
      return (
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-3 rounded-xl border border-emerald-500/20 text-sm font-bold">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 bg-rose-500/10 text-rose-400 px-4 py-3 rounded-xl border border-rose-500/20 text-sm font-bold">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
              <Settings size={13} />
              Sistema
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Configurações
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Gerencie segurança, PIN global e acessos das lojas.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-3 w-fit">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              PIN Global Atual
            </p>

            <p className="text-lg font-black text-emerald-400 mt-1">
              ****{currentPin.slice(-2)}
            </p>
          </div>
        </header>

        {renderStatusMessage()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
              Segurança
            </p>

            <h2 className="text-white font-bold mt-1">
              PIN compartilhado
            </h2>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              O PIN alterado aqui será usado em todos os computadores e nos dois
              acessos cadastrados.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <Store className="w-5 h-5 text-blue-400" />
            </div>

            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
              Loja Vila
            </p>

            <h2 className="text-white font-bold mt-1">
              Acesso autorizado
            </h2>

            <p className="text-xs text-slate-500 mt-2">
              Gerencie a senha vinculada ao login da Vila Esportiva.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <Store className="w-5 h-5 text-purple-400" />
            </div>

            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
              Loja Glória
            </p>

            <h2 className="text-white font-bold mt-1">
              Acesso autorizado
            </h2>

            <p className="text-xs text-slate-500 mt-2">
              Gerencie a senha vinculada ao login do Jardim da Glória.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Credenciais e Segurança
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Escolha abaixo qual configuração deseja alterar.
            </p>
          </div>

          <div className="divide-y divide-slate-800">
            <SettingRow
              icon={<Lock className="w-4 h-4 text-emerald-400" />}
              title="PIN Global de Segurança"
              description={`Usado nas telas protegidas. Atual: ****${currentPin.slice(
                -2
              )}`}
              badge="Global"
              onClick={() => startVerification("security_pin")}
            />

            <SettingRow
              icon={<Key className="w-4 h-4 text-blue-400" />}
              title="Senha da Loja Vila"
              description="Altere a senha de acesso da loja Vila Esportiva."
              badge="Login"
              onClick={() => startVerification("vila_password")}
            />

            <SettingRow
              icon={<Key className="w-4 h-4 text-purple-400" />}
              title="Senha da Loja Glória"
              description="Altere a senha de acesso do Jardim da Glória."
              badge="Login"
              onClick={() => startVerification("gloria_password")}
            />
          </div>
        </div>
      </div>

      {verification.step !== "idle" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-4 z-50 backdrop-blur-sm">
          <div className="bg-[#020617] w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

            <button
              onClick={cancelVerification}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">
                    Alterar {getModalTitle(verification.targetSetting)}
                  </h3>

                  <p className="text-xs text-slate-500">
                    Confirme os dados para prosseguir.
                  </p>
                </div>
              </div>

              {verification.step === "confirm" ? (
                <>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <p className="text-white font-bold text-sm">
                      Confirmação necessária
                    </p>

                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Você está prestes a alterar{" "}
                      <strong className="text-slate-300">
                        {getModalTitle(verification.targetSetting)}
                      </strong>
                      . Essa alteração será aplicada conforme a configuração
                      escolhida.
                    </p>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={confirmAndProceed}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold transition"
                    >
                      Prosseguir
                    </button>

                    <button
                      onClick={cancelVerification}
                      className="px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-sm font-bold transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {error && <div className="mb-4">{renderStatusMessage()}</div>}

                  {verification.targetSetting === "security_pin" ? (
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">
                        Novo PIN Global
                      </label>

                      <input
                        type="password"
                        value={securityPin}
                        onChange={(e) =>
                          setSecurityPin(
                            e.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.6em] text-white outline-none transition"
                        maxLength={4}
                        placeholder="••••"
                      />

                      <p className="text-xs text-slate-500 mt-2">
                        Esse PIN valerá para Vila Esportiva, Jardim da Glória e
                        todos os computadores.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <InputField
                        label="Senha atual"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                      />

                      <InputField
                        label="Nova senha"
                        value={newPassword}
                        onChange={setNewPassword}
                      />

                      <InputField
                        label="Confirmar nova senha"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={changePassword}
                      disabled={isChangeDisabled()}
                      className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                        isChangeDisabled()
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      Confirmar Alteração
                    </button>

                    <button
                      onClick={cancelVerification}
                      className="px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-sm font-bold transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-900/60 transition text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">
              {title}
            </p>

            <span className="text-[9px] uppercase font-black text-slate-500 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
              {badge}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">
        {label}
      </label>

      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white outline-none transition text-sm"
      />
    </div>
  );
}