// src/components/PinGate.tsx
// Bloqueia telas sensíveis (Produtos e Relatórios) com o PIN de 4 dígitos da loja.
// Depois de 5 tentativas erradas, bloqueia por 30 segundos.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Page, Card } from "./ui";

const LIMIT = 5;
const BLOCK_SECONDS = 30;

export default function PinGate({ title, requiredPin, unlocked, onUnlock, children }: {
    title: string;
    requiredPin: string | null; // null enquanto carrega do banco
    unlocked: boolean;
    onUnlock: () => void;
    children: ReactNode;
}) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [blockedFor, setBlockedFor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (blockedFor <= 0) return;
        const t = setTimeout(() => setBlockedFor(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [blockedFor]);

    useEffect(() => { if (!unlocked) inputRef.current?.focus(); }, [unlocked, blockedFor]);

    if (unlocked) return <>{children}</>;

    const type = (value: string) => {
        if (blockedFor > 0 || requiredPin === null) return;
        const v = value.replace(/\D/g, "").slice(0, 4);
        setPin(v);
        setError("");
        if (v.length < 4) return;
        if (v === requiredPin) {
            setAttempts(0);
            onUnlock();
            return;
        }
        const n = attempts + 1;
        setAttempts(n);
        setPin("");
        if (n >= LIMIT) {
            setBlockedFor(BLOCK_SECONDS);
            setAttempts(0);
            setError(`Muitas tentativas. Aguarde ${BLOCK_SECONDS} segundos.`);
        } else {
            setError(`PIN incorreto. ${LIMIT - n} ${LIMIT - n === 1 ? "tentativa restante" : "tentativas restantes"}.`);
        }
    };

    return (
        <Page narrow>
            <div className="flex min-h-[60vh] items-center justify-center">
                <Card className="w-full max-w-sm text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-subtle text-fg-subtle">
                        <Lock className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-fg">{title}</h2>
                    <p className="mt-1 text-sm text-fg-subtle">Digite o PIN de 4 dígitos para continuar.</p>

                    {requiredPin === null ? (
                        <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-fg-faint" />
                    ) : (
                        <>
                            <input
                                ref={inputRef}
                                value={pin}
                                onChange={e => type(e.target.value)}
                                inputMode="numeric"
                                type="password"
                                autoComplete="off"
                                maxLength={4}
                                disabled={blockedFor > 0}
                                aria-label="PIN"
                                className="ui-input mt-6 h-14 text-center text-2xl tracking-[0.6em] tabular"
                                placeholder="••••"
                            />
                            <div className="mt-3 flex justify-center gap-2">
                                {[0, 1, 2, 3].map(i => (
                                    <span key={i} className={`h-2 w-2 rounded-full ${i < pin.length ? "bg-primary" : "bg-line-strong"}`} />
                                ))}
                            </div>
                        </>
                    )}

                    {(error || blockedFor > 0) && (
                        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                            {blockedFor > 0 ? `Muitas tentativas. Tente de novo em ${blockedFor}s.` : error}
                        </p>
                    )}
                </Card>
            </div>
        </Page>
    );
}
