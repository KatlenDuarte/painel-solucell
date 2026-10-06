// src/components/ErrorBoundary.tsx
// Evita a "tela branca": se uma tela quebrar (ex.: um registro com dados
// inesperados), mostra o erro e permite tentar novamente sem sair do sistema.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
    children: ReactNode;
    onReset?: () => void;
}

interface State {
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Erro ao renderizar a tela:", error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--ui-shadow)]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-fg">Não foi possível abrir esta tela</h2>
                    <p className="mt-1 text-sm text-fg-subtle">
                        Algum registro tem um formato inesperado. Tente novamente; se persistir, envie a mensagem abaixo para o suporte.
                    </p>
                    <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-subtle p-3 text-left text-xs text-fg-muted whitespace-pre-wrap">
                        {this.state.error.message}
                    </pre>
                    <div className="mt-5 flex justify-center gap-2">
                        <button
                            onClick={() => this.setState({ error: null })}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
                        >
                            <RotateCcw className="h-4 w-4" /> Tentar novamente
                        </button>
                        {this.props.onReset && (
                            <button
                                onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}
                                className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-fg hover:bg-hover"
                            >
                                Ir para Vendas
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}
