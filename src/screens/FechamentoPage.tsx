import { useState, useEffect, useCallback, useMemo } from "react";
import { useStoreData } from "../contexts/StoreDataContext";
import {
    Trash2, Package, Wallet,
    CheckCircle2, FileText, ArrowUpCircle, ArrowDownCircle,
    AlertCircle, Landmark, X
} from "lucide-react";
import { Page, PageHeader, Card, CardHeader, StatCard, Button, IconButton, Badge, EmptyState, LoadingState } from "../components/ui";
import { formatBRL } from "../lib/format";

import {
    collection, getDocs, query, where, addDoc,
    serverTimestamp, deleteDoc, doc, updateDoc, limit, onSnapshot, Timestamp
} from "../lib/firestore";
import { db } from "../lib/firebase";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Outflow {
    id: string;
    description: string;
    amount: number;
    type: 'in' | 'out';
    time: string;
}

// Valores em formato brasileiro: "1.234,56" -> 1234.56 (também aceita "1234.56")
const parseMoney = (v: string) => {
    const t = (v || "").trim().replace(/[^\d,.-]/g, "");
    if (!t) return NaN;
    const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
    return Number(normalized);
};

interface SoldItem {
    name: string;
    qty: number;
}

export default function FechamentoPage({ storeEmail }: { storeEmail: string }) {
    const [isLoading, setIsLoading] = useState(true);
    // Regras do Firebase ainda não liberam as coleções do caixa (cash_sessions / outflows)
    const [blocked, setBlocked] = useState(false);
    const denied = (e: unknown) => (e as { code?: string })?.code === "permission-denied";
    const failMsg = (e: unknown, msg: string) => {
        if (denied(e)) { setBlocked(true); alert("O Firebase desta loja ainda não permite usar o caixa. É preciso liberar as coleções do caixa nas regras do Firebase."); }
        else alert(msg);
    };
    const [isClosing, setIsClosing] = useState(false);
    const [isOpening, setIsOpening] = useState(false);

    const [isCashOpen, setIsCashOpen] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [openedAtTimestamp, setOpenedAtTimestamp] = useState<Timestamp | null>(null);

    const [cashOpenedAt, setCashOpenedAt] = useState("");
    const [initialBalance, setInitialBalance] = useState(0);
    const [tempInitialBalance, setTempInitialBalance] = useState<string>("");

    const [movements, setMovements] = useState<Outflow[]>([]);

    const [newDesc, setNewDesc] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [savingMov, setSavingMov] = useState<"in" | "out" | null>(null);

    // Estados do Modal de Fechamento Customizado
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [physicalCashInput, setPhysicalCashInput] = useState("");

    // Vendas: vêm do listener em tempo real da loja (sem consulta extra e sem índice composto)
    const { sales: salesDocs } = useStoreData();

    const { summary, soldItems } = useMemo(() => {
        const acc = { pix: 0, cartao: 0, dinheiro: 0, fiado: 0 };
        const itemsMap: Record<string, number> = {};
        if (!isCashOpen) return { summary: acc, soldItems: [] as SoldItem[] };
        const fromMs = openedAtTimestamp?.toMillis?.() ?? new Date().setHours(0, 0, 0, 0);

        salesDocs.forEach(docSnap => {
            const d = docSnap.data();
            if (d.status === "refunded" || d.status === "cancelled" || d.status === "loss" || d.type === "perda") return;
            // venda recém-criada ainda sem horário do servidor conta como "agora"
            const ms = d.timestamp?.toMillis?.() ?? Date.now();
            if (ms < fromMs) return;

            const valor = Number(d.total) || 0;
            const add = (method: string, v: number) => {
                const m = String(method || "").toUpperCase();
                if (m.includes("PIX")) acc.pix += v;
                else if (m.includes("CART")) acc.cartao += v;
                else if (m.includes("DINHEIRO")) acc.dinheiro += v;
                else if (m.includes("FIADO")) acc.fiado += v;
            };
            if (Array.isArray(d.multiplePayments) && d.multiplePayments.length > 0) {
                d.multiplePayments.forEach((p: any) => add(p.method, Number(p.value) || 0));
            } else {
                add(d.paymentMethod, valor);
            }

            d.items?.forEach((it: any) => {
                const name = it?.name || "Item";
                itemsMap[name] = (itemsMap[name] || 0) + (Number(it.saleQty ?? it.quantity) || 1);
            });
        });

        return { summary: acc, soldItems: Object.entries(itemsMap).map(([name, qty]) => ({ name, qty })) };
    }, [salesDocs, isCashOpen, openedAtTimestamp]);

    // Movimentações manuais do turno, em tempo real (consulta simples por sessionId)
    useEffect(() => {
        if (!currentSessionId) return;
        const q = query(collection(db, "outflows"), where("sessionId", "==", currentSessionId));
        return onSnapshot(q, (snap: { docs: { id: string; data: () => any }[] }) => {
            const list = snap.docs
                .map(d => ({ id: d.id, data: d.data() }))
                .filter(x => !x.data.store || x.data.store === storeEmail)
                .map(({ id, data }) => {
                    const ts: Date | null = data.timestamp?.toDate?.() ?? null;
                    return {
                        id,
                        description: String(data.description || ""),
                        amount: Number(data.amount) || 0,
                        type: (data.type === "in" ? "in" : "out") as "in" | "out",
                        time: ts ? ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "agora",
                        ms: ts ? ts.getTime() : Number.MAX_SAFE_INTEGER,
                    };
                })
                .sort((a, b) => a.ms - b.ms);
            setMovements(list);
        }, (e: unknown) => {
            if (denied(e)) setBlocked(true);
            console.error("Erro ao carregar movimentações:", e);
        });
    }, [currentSessionId, storeEmail]);

    const checkActiveSession = useCallback(async () => {
        if (!storeEmail) return;
        setIsLoading(true);
        try {
            const q = query(
                collection(db, "cash_sessions"),
                where("store", "==", storeEmail),
                where("status", "==", "open"),
                limit(1)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                const session = snap.docs[0];
                const data = session.data();
                const sessionOpenedAt = data.openedAt as Timestamp;

                setCurrentSessionId(session.id);
                setOpenedAtTimestamp(sessionOpenedAt);
                setInitialBalance(Number(data.initialBalance) || 0);
                setCashOpenedAt(sessionOpenedAt?.toDate()?.toLocaleString("pt-BR") || "Data indisponível");
                setIsCashOpen(true);
            } else {
                setIsCashOpen(false);
                setCurrentSessionId(null);
            }
        } catch (e) {
            if (denied(e)) setBlocked(true);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        checkActiveSession();
    }, [checkActiveSession]);

    const totalOut = movements.filter(m => m.type === 'out').reduce((acc, i) => acc + i.amount, 0);
    const totalIn = movements.filter(m => m.type === 'in').reduce((acc, i) => acc + i.amount, 0);
    const saldoFinalGaveta = initialBalance + summary.dinheiro + totalIn - totalOut;

    const parsedPhysicalCash = parseMoney(physicalCashInput) || 0;
    const currentDifference = parsedPhysicalCash - saldoFinalGaveta;

    const generateDetailedPDF = (physical: number, diff: number) => {
        const docPdf = new jsPDF();
        const now = new Date().toLocaleString("pt-BR");

        docPdf.setFontSize(18);
        docPdf.text("RELATÓRIO DE FECHAMENTO - SOLUCELL", 14, 20);

        docPdf.setFontSize(10);
        docPdf.text(`Loja: ${storeEmail}`, 14, 28);
        docPdf.text(`Abertura: ${cashOpenedAt} | Fechamento: ${now}`, 14, 33);

        autoTable(docPdf, {
            startY: 40,
            head: [['Resumo de Gaveta (Dinheiro)', 'Valor']],
            body: [
                ['Fundo Inicial', `R$ ${initialBalance.toFixed(2)}`],
                ['Vendas em Dinheiro', `R$ ${summary.dinheiro.toFixed(2)}`],
                ['Entradas (Aportes)', `R$ ${totalIn.toFixed(2)}`],
                ['Saídas (Sangrias)', `R$ ${totalOut.toFixed(2)}`],
                ['SALDO ESPERADO', `R$ ${saldoFinalGaveta.toFixed(2)}`],
                ['SALDO CONTADO', `R$ ${physical.toFixed(2)}`],
                ['DIFERENÇA', `R$ ${diff.toFixed(2)}`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [234, 88, 12] },
        });

        autoTable(docPdf, {
            startY: (docPdf as any).lastAutoTable.finalY + 10,
            head: [['Outros Recebimentos', 'Valor']],
            body: [
                ['Vendas PIX', `R$ ${summary.pix.toFixed(2)}`],
                ['Vendas Cartão', `R$ ${summary.cartao.toFixed(2)}`],
                ['Vendas Fiado', `R$ ${summary.fiado.toFixed(2)}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105] },
        });

        if (soldItems.length > 0) {
            autoTable(docPdf, {
                startY: (docPdf as any).lastAutoTable.finalY + 10,
                head: [['Produto Vendido', 'Quantidade']],
                body: soldItems.map(i => [i.name, `${i.qty} un`]),
                headStyles: { fillColor: [16, 185, 129] },
            });
        }

        docPdf.save(`Fechamento_${storeEmail}_${Date.now()}.pdf`);
    };

    const handleExecuteCloseCash = async () => {
        const physicalCash = parseMoney(physicalCashInput);
        if (isNaN(physicalCash)) return alert("Por favor, insira um valor válido para o dinheiro contado.");

        setIsClosing(true);
        try {
            generateDetailedPDF(physicalCash, currentDifference);
            if (currentSessionId) {
                await updateDoc(doc(db, "cash_sessions", currentSessionId), {
                    status: "closed",
                    closedAt: serverTimestamp(),
                    expected: saldoFinalGaveta,
                    physical: physicalCash,
                    difference: currentDifference
                });
            }
            setIsClosingModalOpen(false);
            setPhysicalCashInput("");
            setIsCashOpen(false);
            setCurrentSessionId(null);
            setMovements([]);
            setOpenedAtTimestamp(null);
        } catch (e) {
            failMsg(e, "Erro ao fechar o caixa.");
        } finally {
            setIsClosing(false);
        }
    };

    const handleAddMovement = async (type: 'in' | 'out') => {
        const numericValue = parseMoney(newAmount);
        if (!newDesc.trim() || !(numericValue > 0) || !currentSessionId) {
            return alert("Informe a descrição e um valor maior que zero.");
        }

        setSavingMov(type);
        try {
            await addDoc(collection(db, "outflows"), {
                store: storeEmail,
                description: newDesc.trim(),
                amount: numericValue,
                type: type,
                sessionId: currentSessionId,
                timestamp: serverTimestamp()
            });
            setNewDesc("");
            setNewAmount("");
        } catch (e) {
            failMsg(e, "Erro ao salvar a movimentação.");
        } finally {
            setSavingMov(null);
        }
    };

    const handleDeleteMovement = async (id: string) => {
        if (!confirm("Excluir esta movimentação?")) return;
        try {
            await deleteDoc(doc(db, "outflows", id));
        } catch (e) {
            failMsg(e, "Erro ao deletar.");
        }
    };

    const handleOpenCash = async () => {
        const val = parseMoney(tempInitialBalance);
        if (isNaN(val) || val < 0) return alert("Por favor, insira um valor inicial válido.");
        setIsOpening(true);
        try {
            await addDoc(collection(db, "cash_sessions"), {
                store: storeEmail,
                initialBalance: val,
                openedAt: serverTimestamp(),
                status: "open"
            });
            setTempInitialBalance("");
            await checkActiveSession();
        } catch (e) {
            failMsg(e, "Erro ao abrir caixa.");
        } finally {
            setIsOpening(false);
        }
    };

    const closeModal = () => {
        setIsClosingModalOpen(false);
        setPhysicalCashInput("");
    };

    if (isLoading) return <LoadingState label="Verificando o caixa..." />;

    if (!isCashOpen) {
        return (
            <Page narrow>
                {blocked && (
                    <div role="alert" className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
                        <b>Caixa bloqueado pelo Firebase.</b> As regras de segurança desta loja ainda não liberam o caixa
                        (coleções <code>cash_sessions</code> e <code>outflows</code>). Depois de liberar, recarregue a página.
                    </div>
                )}
                <PageHeader
                    title="Fechamento de caixa"
                    description="Abra o turno informando o fundo de troco. As vendas do dia são somadas automaticamente."
                    meta={<Badge tone="danger" dot>Caixa fechado</Badge>}
                />

                <Card padded={false}>
                    <CardHeader title="Abrir turno" description="Valor em dinheiro separado para troco na gaveta" icon={Wallet} />
                    <div className="p-5 space-y-5">
                        <div>
                            <label className="ui-label" htmlFor="fundo">Fundo de caixa</label>
                            <div className="relative max-w-xs">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">R$</span>
                                <input
                                    id="fundo"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    className="ui-input h-11 pl-10 text-lg font-semibold tabular"
                                    value={tempInitialBalance}
                                    onChange={e => setTempInitialBalance(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && tempInitialBalance) handleOpenCash(); }}
                                />
                            </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm text-info">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>Ao abrir o caixa você poderá registrar entradas e saídas manuais e, no fim do dia, conferir o dinheiro da gaveta.</span>
                        </div>
                    </div>
                    <div className="flex justify-end border-t border-line px-5 py-4">
                        <Button variant="primary" icon={CheckCircle2} loading={isOpening} disabled={!tempInitialBalance} onClick={handleOpenCash}>
                            Abrir caixa
                        </Button>
                    </div>
                </Card>
            </Page>
        );
    }

    return (
        <Page>
            {blocked && (
                    <div role="alert" className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
                        <b>Caixa bloqueado pelo Firebase.</b> As regras de segurança desta loja ainda não liberam o caixa
                        (coleções <code>cash_sessions</code> e <code>outflows</code>). Depois de liberar, recarregue a página.
                    </div>
                )}
            <PageHeader
                title="Fechamento de caixa"
                description={`Turno aberto em ${cashOpenedAt}.`}
                meta={<Badge tone="success" dot>Caixa aberto</Badge>}
                actions={
                    <Button variant="primary" icon={FileText} onClick={() => setIsClosingModalOpen(true)}>
                        Encerrar caixa
                    </Button>
                }
            />

            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
                <StatCard label="Fundo inicial" value={formatBRL(initialBalance)} icon={Wallet} />
                <StatCard label="Vendas em dinheiro" value={formatBRL(summary.dinheiro)} icon={Landmark} tone="success" />
                <StatCard label="Entradas" value={formatBRL(totalIn)} icon={ArrowUpCircle} tone="success" hint={`${movements.filter(m => m.type === 'in').length} aportes`} />
                <StatCard label="Saídas" value={formatBRL(totalOut)} icon={ArrowDownCircle} tone="danger" hint={`${movements.filter(m => m.type === 'out').length} sangrias`} />
                <StatCard label="PIX + Cartão" value={formatBRL(summary.pix + summary.cartao)} icon={Package} tone="info" className="col-span-2 md:col-span-1"
                    hint={`PIX ${formatBRL(summary.pix)} · Cartão ${formatBRL(summary.cartao)}`} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Saldo esperado */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-medium text-fg-subtle">Saldo esperado na gaveta</p>
                        <p className="mt-2 text-4xl font-semibold tracking-tight text-fg tabular">{formatBRL(saldoFinalGaveta)}</p>
                    </div>
                    <dl className="mt-6 space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-fg-subtle">Fundo inicial</dt><dd className="tabular text-fg">{formatBRL(initialBalance)}</dd></div>
                        <div className="flex justify-between"><dt className="text-fg-subtle">+ Vendas em dinheiro</dt><dd className="tabular text-fg">{formatBRL(summary.dinheiro)}</dd></div>
                        <div className="flex justify-between"><dt className="text-fg-subtle">+ Entradas</dt><dd className="tabular text-fg">{formatBRL(totalIn)}</dd></div>
                        <div className="flex justify-between"><dt className="text-fg-subtle">− Saídas</dt><dd className="tabular text-fg">{formatBRL(totalOut)}</dd></div>
                        {summary.fiado > 0 && (
                            <div className="flex justify-between border-t border-line pt-2"><dt className="text-fg-subtle">Fiado no turno (não entra na gaveta)</dt><dd className="tabular text-danger">{formatBRL(summary.fiado)}</dd></div>
                        )}
                    </dl>
                </Card>

                {/* Movimentações */}
                <Card padded={false} className="xl:col-span-2 overflow-hidden">
                    <CardHeader title="Movimentações manuais" description="Aportes (entradas) e sangrias (saídas) da gaveta" icon={ArrowUpCircle} />
                    <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
                        <input placeholder="Descrição (ex.: troco, pagamento de fornecedor)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="ui-input flex-1" />
                        <div className="relative sm:w-32">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">R$</span>
                            <input placeholder="0,00" inputMode="decimal" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="ui-input pl-9 tabular" />
                        </div>
                        <div className="flex gap-2">
                            <Button icon={ArrowUpCircle} loading={savingMov === 'in'} disabled={!!savingMov} onClick={() => handleAddMovement('in')} className="flex-1 text-success">Entrada</Button>
                            <Button icon={ArrowDownCircle} loading={savingMov === 'out'} disabled={!!savingMov} onClick={() => handleAddMovement('out')} className="flex-1 text-danger">Saída</Button>
                        </div>
                    </div>
                    {movements.length === 0 ? (
                        <EmptyState icon={Landmark} title="Nenhuma movimentação" description="Registre aqui trocos, sangrias e pagamentos feitos com o dinheiro da gaveta." className="py-10" />
                    ) : (
                        <ul className="divide-y divide-line max-h-72 overflow-y-auto">
                            {movements.map(m => (
                                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.type === 'in' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                                        {m.type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-fg">{m.description}</p>
                                        <p className="text-xs text-fg-subtle">{m.type === 'in' ? 'Entrada' : 'Saída'} · {m.time}</p>
                                    </div>
                                    <span className={`text-sm font-medium tabular ${m.type === 'in' ? 'text-success' : 'text-danger'}`}>
                                        {m.type === 'in' ? '+' : '−'} {formatBRL(m.amount)}
                                    </span>
                                    <IconButton icon={Trash2} label="Excluir movimentação" tone="danger" onClick={() => handleDeleteMovement(m.id)} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <Card padded={false} className="overflow-hidden">
                <CardHeader title="Itens vendidos no turno" description={`${soldItems.length} produtos diferentes`} icon={Package} />
                {soldItems.length === 0 ? (
                    <EmptyState icon={Package} title="Nenhum item vendido ainda" description="Os produtos vendidos hoje aparecem aqui." className="py-10" />
                ) : (
                    <div className="max-h-80 overflow-y-auto">
                        <table className="ui-table">
                            <thead><tr><th>Produto</th><th className="!text-right">Quantidade</th></tr></thead>
                            <tbody>
                                {soldItems.map((item, i) => (
                                    <tr key={`item-${i}`}>
                                        <td className="text-fg">{item.name}</td>
                                        <td className="text-right tabular">{item.qty} un</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* MODAL DE FECHAMENTO */}
            {isClosingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={closeModal}>
                    <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-line px-5 py-4">
                            <div>
                                <h3 className="text-base font-semibold text-fg">Conferência de caixa</h3>
                                <p className="mt-0.5 text-sm text-fg-subtle">Conte o dinheiro físico da gaveta e informe o total.</p>
                            </div>
                            <IconButton icon={X} label="Fechar" onClick={closeModal} />
                        </div>

                        <div className="space-y-4 p-5">
                            <div className="flex items-center justify-between rounded-lg bg-subtle border border-line px-4 py-3 text-sm">
                                <span className="text-fg-subtle">Saldo esperado</span>
                                <span className="font-semibold text-fg tabular">{formatBRL(saldoFinalGaveta)}</span>
                            </div>

                            <div>
                                <label className="ui-label" htmlFor="contado">Valor contado</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">R$</span>
                                    <input
                                        id="contado"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={physicalCashInput}
                                        onChange={e => setPhysicalCashInput(e.target.value)}
                                        className="ui-input h-12 pl-10 text-xl font-semibold tabular"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {physicalCashInput.trim() !== "" && (
                                <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${Math.abs(currentDifference) < 0.005
                                    ? 'bg-success-soft text-success'
                                    : currentDifference > 0 ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'}`}>
                                    {Math.abs(currentDifference) < 0.005 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {Math.abs(currentDifference) < 0.005 && "Caixa conferido: os valores batem."}
                                    {currentDifference >= 0.005 && `Sobra de ${formatBRL(currentDifference)} no caixa.`}
                                    {currentDifference <= -0.005 && `Falta de ${formatBRL(Math.abs(currentDifference))} no caixa.`}
                                </div>
                            )}
                            <p className="text-xs text-fg-subtle">Ao confirmar, o relatório em PDF é baixado e o turno é encerrado.</p>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
                            <Button onClick={closeModal}>Cancelar</Button>
                            <Button variant="primary" loading={isClosing} disabled={!physicalCashInput} onClick={handleExecuteCloseCash}>
                                Confirmar e fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
}
