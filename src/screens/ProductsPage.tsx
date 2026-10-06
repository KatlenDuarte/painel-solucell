import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Plus, Search, Smartphone, Shield, Cable, Headphones,
    Edit, Trash2, Package, TriangleAlert, FileText,
    ArrowUp, ArrowDown, DollarSign, Layers, AlertCircle, Scan, Printer
} from "lucide-react";
import { Page, PageHeader, Card, StatCard, Button, IconButton, Badge, SearchInput, EmptyState, LoadingState } from "../components/ui";
import { formatBRL } from "../lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import bwipjs from "bwip-js"; // 🌟 Biblioteca para gerar o desenho do código de barras real no PDF

import { useStoreData } from "../contexts/StoreDataContext";
import { deleteProduct, updateProduct } from "../services/productsService";

import AddProductModal from "../components/AddProductModal";
import EditStockModal from "../components/EditStockModal";
import LabelActionModal from "../components/LabelActionModal";

interface Product {
    id: string;
    name: string;
    category: string;
    brand: string;
    model: string;
    stock: number;
    minStock: number;
    price: number;
    status: "ok" | "low" | "critical";
    costPrice?: number | null;
    barcode?: string | null;
}

// 🌟 Interface para os itens que vão para a fila de impressão
interface LabelItem {
    id: string;
    name: string;
    brand: string;
    model: string;
    price: number;
    barcode: string;
    quantity: number;
}

type SortField = "name" | "stock" | "price";
type SortDirection = "asc" | "desc";

export default function ProductsContent() {
    const { storeEmail: effectiveStoreEmail, products: productDocs, productsLoading: loading } = useStoreData();

    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [isReplenishmentMode, setIsReplenishmentMode] = useState(false);

    const [sortField, setSortField] = useState<SortField>("stock");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);
    const [startPosition, setStartPosition] = useState(1);

    // 🌟 ESTADOS DA FILA DE IMPRESSÃO DE ETIQUETAS
    const [labelQueue, setLabelQueue] = useState<LabelItem[]>([]);
    const [isGeneratingLabels, setIsGeneratingLabels] = useState(false);

    // 🌟 NOVOS ESTADOS PARA O MODAL DE ETIQUETAS COLETADAS
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [productPendingLabel, setProductPendingLabel] = useState<Product | null>(null);

    // Referências para o leitor de código de barras físico
    const barcodeBuffer = useRef<string>("");
    const lastKeyTime = useRef<number>(0);

    const determineStatus = (stock: number, minStock: number) => {
        if (stock <= 0) return "critical";
        if (stock <= minStock) return "low";
        return "ok";
    };

    // Produtos chegam em tempo real pelo listener compartilhado (StoreDataContext),
    // sem reler a coleção inteira a cada visita ou alteração.
    const products = useMemo<Product[]>(() => productDocs.map((docSnap) => {
        const p: any = { id: docSnap.id, ...docSnap.data() };
        const stock = Number(p.stock || 0);
        const minStock = Number(p.minStock || 5);
        return {
            ...p,
            name: String(p.name ?? ""),
            brand: String(p.brand ?? ""),
            model: String(p.model ?? ""),
            category: String(p.category ?? ""),
            stock,
            minStock,
            price: Number(p.price || 0),
            costPrice: p.costPrice !== undefined ? p.costPrice : null,
            barcode: p.barcode || null,
            status: determineStatus(stock, minStock)
        };
    }), [productDocs]);

    // Mantido para os callbacks dos modais: o listener já reflete as alterações.
    const loadProducts = useCallback(async () => {}, []);

    // 🌟 ADICIONAR PRODUTO À FILA DE ETIQUETAS (ATUALIZADO PARA SUPORTAR EDIÇÃO)
    const handleAddToLabelQueue = async (
        product: Product,
        customQty?: number,
        updatedData?: {
            newName: string;
            newPrice: number;
            newMinStock: number;
            newStock: number;
            newCostPrice: number | null;
            newBarcode: string | null;
        }
    ) => {
        // Se não veio uma quantidade definida, abre o modal enviando o objeto inteiro
        if (customQty === undefined) {
            setProductPendingLabel(product);
            setIsLabelModalOpen(true);
            return;
        }

        let targetProduct = product;

        // Se o usuário alterou dados no modal, salva primeiro no Firebase/Service
        if (updatedData) {
            try {
                await updateProduct(product.id, {
                    name: updatedData.newName,
                    price: updatedData.newPrice,
                    minStock: updatedData.newMinStock,
                    costPrice: updatedData.newCostPrice,
                    barcode: updatedData.newBarcode,
                    stock: updatedData.newStock// mantém o estoque atual
                });

                // Cria um objeto mesclado com os dados novos para ir direto para a impressão atualizado
                targetProduct = {
                    ...product,
                    name: updatedData.newName,
                    price: updatedData.newPrice,
                    stock: updatedData.newStock,
                    minStock: updatedData.newMinStock,
                    costPrice: updatedData.newCostPrice,
                    barcode: updatedData.newBarcode,
                    status: determineStatus(
                        updatedData.newStock,
                        updatedData.newMinStock
                    )
                };

            } catch (err) {
                console.error("Erro ao atualizar produto antes da impressão:", err);
                alert("Erro ao salvar novos dados do produto, mas prosseguindo com a etiqueta antiga.");
            }
        }

        // Validação de segurança pós-edição (caso o código de barras tenha sido apagado ou deixado em branco)
        if (!targetProduct.barcode) {
            alert("Este produto não possui código de barras válido para gerar a etiqueta!");
            return;
        }

        if (customQty <= 0) return;

        setLabelQueue(prev => {
            const existing = prev.find(item => item.id === targetProduct.id);
            if (existing) {
                return prev.map(item => item.id === targetProduct.id ? { ...item, quantity: item.quantity + customQty } : item);
            }
            return [...prev, {
                id: targetProduct.id,
                name: targetProduct.name,
                brand: targetProduct.brand,
                model: targetProduct.model,
                price: targetProduct.price,
                barcode: targetProduct.barcode,
                quantity: customQty
            }];
        });
    };

    // 🌟 CAPTURA GLOBAL DO LEITOR DE CÓDIGO DE BARRAS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
                return;
            }

            const currentTime = Date.now();
            if (currentTime - lastKeyTime.current > 100) {
                barcodeBuffer.current = "";
            }
            lastKeyTime.current = currentTime;

            if (e.key === "Enter") {
                if (barcodeBuffer.current.length > 3) {
                    const scannedCode = barcodeBuffer.current.trim();
                    barcodeBuffer.current = "";

                    const productFound = products.find(p => p.barcode === scannedCode);

                    if (productFound) {
                        // Ao bipar, ele já oferece para colocar na folha de impressão mista
                        handleAddToLabelQueue(productFound);
                    } else {
                        alert(`Código "${scannedCode}" não encontrado no inventário.`);
                    }
                }
            } else if (e.key.length === 1) {
                barcodeBuffer.current += e.key;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [products]);

    // 🌟 IMPRESSÃO OTIMIZADA DE FOLHA MISTA (PIMACO 3 COLUNAS X 10 LINHAS COMO EXEMPLO)
    const exportMixedLabelsPDF = async () => {
        if (labelQueue.length === 0) {
            alert("A fila de etiquetas está vazia!");
            return;
        }

        const iniciarNaPosicao = startPosition;

        if (isNaN(iniciarNaPosicao) || iniciarNaPosicao < 1 || iniciarNaPosicao > 40) return;

        setIsGeneratingLabels(true);

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // Configurações de Margem padrão Folha A4 Pimaco

        const maxColumns = 4;
        const maxRows = 12;

        const labelWidth = 48;   // menor
        const labelHeight = 22;  // menor

        const gapX = 2;
        const gapY = 0;
        const marginLeft = 5;
        const marginTop = 10;

        // Posição inicial baseada na escolha do usuário (ajuste para index 0)
        let currentColumn = (iniciarNaPosicao - 1) % maxColumns;
        let currentRow = Math.floor((iniciarNaPosicao - 1) / maxColumns);

        // Planifica a fila multiplicando pelas quantidades escolhidas
        const flattenedLabels: LabelItem[] = [];
        labelQueue.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                flattenedLabels.push(item);
            }
        });

        // Função auxiliar para gerar a imagem do código de barras em formato buffer/canvas
        const generateBarcodeImage = (text: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement("canvas");
                bwipjs.toCanvas(canvas, {
                    bcid: "code128",       // Tipo do código de barras
                    text: text,            // Valor numérico
                    scale: 3,              // Resolução
                    height: 10,            // Altura do traçado
                    includetext: false,    // Remove o texto debaixo das barras (escrevemos manualmente menor)
                });
                resolve(canvas.toDataURL("image/png"));
            });
        };

        for (let i = 0; i < flattenedLabels.length; i++) {
            const label = flattenedLabels[i];

            if (currentRow >= maxRows) {
                doc.addPage();
                currentRow = 0;
                currentColumn = 0;
            }

            const x = marginLeft + currentColumn * (labelWidth + gapX);
            const y = marginTop + currentRow * (labelHeight + gapY);

            // Fundo leve (simulação de card)
            doc.setFillColor(245, 245, 245);
            doc.rect(x, y, labelWidth, labelHeight, "F");

            // Nome produto
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(label.name.substring(0, 28), x + 2, y + 4);

            // Marca / modelo
            doc.setFontSize(5.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 80);
            doc.text(`${label.brand} ${label.model}`.substring(0, 30), x + 2, y + 8);

            // Preço (destaque)
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(16, 185, 129);
            doc.text(`R$ ${label.price.toFixed(2)}`, x + 2, y + 12);

            // Barcode imagem menor e mais ajustada
            try {
                const barcodeImgData = await generateBarcodeImage(label.barcode);
                doc.addImage(
                    barcodeImgData,
                    "PNG",
                    x + 2,
                    y + 13,
                    labelWidth - 4,
                    5
                );
            } catch (err) {
                console.error("Erro barcode", err);
            }

            // código numérico
            doc.setFontSize(5);
            doc.setTextColor(0, 0, 0);
            doc.text(label.barcode, x + labelWidth / 2, y + 20.5, {
                align: "center"
            });
            currentColumn++;
            if (currentColumn >= maxColumns) {
                currentColumn = 0;
                currentRow++;
            }
        }

        doc.save("folha-etiquetas-mistas.pdf");
        setLabelQueue([]); // Limpa a fila após gerar com sucesso
        setIsGeneratingLabels(false);
    };

    const handleUpdateProduct = async (
        productId: string,
        newStock: number,
        operation: string,
        newName: string,
        newPrice: number,
        newMinStock: number,
        newCostPrice: number | null,
        newBarcode: string | null
    ) => {
        try {
            await updateProduct(productId, {
                name: newName, price: newPrice, stock: newStock, minStock: newMinStock, costPrice: newCostPrice, barcode: newBarcode,
            });

            setIsEditStockModalOpen(false);
            setSelectedProduct(null);
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar alterações.");
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir ${name}?`)) return;
        try {
            await deleteProduct(id);
        } catch (err) {
            console.error(err);
        }
    };

    const filteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
            const matchesSearch =
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.barcode && p.barcode.includes(searchTerm));
            const matchesReplenishment = !isReplenishmentMode || p.status !== "ok";
            return matchesCategory && matchesSearch && matchesReplenishment;
        });

        return result.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];
            if (sortField === "name") {
                return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDirection === "asc" ? valA - valB : valB - valA;
        });
    }, [products, selectedCategory, searchTerm, isReplenishmentMode, sortField, sortDirection]);

    const inventoryStats = useMemo(() => {
        const totalItems = products.reduce((acc, p) => acc + Math.max(0, p.stock), 0);
        const totalValue = products.reduce((acc, p) => acc + (p.price * Math.max(0, p.stock)), 0);
        const totalCost = products.reduce((acc, p) => acc + ((Number(p.costPrice) || 0) * Math.max(0, p.stock)), 0);
        const criticalAlerts = products.filter(p => p.status !== "ok").length;
        const outOfStock = products.filter(p => p.stock <= 0).length;
        return { totalItems, totalValue, totalCost, criticalAlerts, outOfStock };
    }, [products]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection(field === "name" ? "asc" : "desc");
        }
    };

    const totalLabelsInQueue = labelQueue.reduce((acc, item) => acc + item.quantity, 0);

    if (loading) return <LoadingState label="Carregando estoque..." />;

    const categories = [
        { id: "all", label: "Todos", icon: Package },
        { id: "peliculas", label: "Películas", icon: Shield },
        { id: "cases", label: "Capas", icon: Smartphone },
        { id: "cabos", label: "Cabos", icon: Cable },
        { id: "acessorios", label: "Acessórios", icon: Headphones },
    ];
    const countByCategory = (id: string) => id === "all" ? products.length : products.filter(p => p.category === id).length;

    const sortHeader = (field: SortField, label: string, align: "left" | "right" = "left") => (
        <button
            onClick={() => handleSort(field)}
            className={`inline-flex items-center gap-1 hover:text-fg ${sortField === field ? "text-fg" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
        >
            {label}
            {sortField === field && (sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
    );

    const stockBadge = (p: Product) => (
        <Badge tone={p.status === "critical" ? "danger" : p.status === "low" ? "warning" : "success"} className="tabular">
            {p.stock <= 0 ? "Esgotado" : `${p.stock} un`}
        </Badge>
    );

    return (
        <Page>
            <PageHeader
                title="Produtos"
                description={<span className="inline-flex items-center gap-1.5"><Scan size={14} className="text-success" /> Leitor ativo: ao bipar um código, o produto entra na fila de etiquetas.</span>}
                actions={
                    <>
                        {totalLabelsInQueue > 0 && (
                            <Button icon={Printer} loading={isGeneratingLabels} onClick={() => setIsPrintConfigOpen(true)}>
                                Imprimir {totalLabelsInQueue} {totalLabelsInQueue === 1 ? "etiqueta" : "etiquetas"}
                            </Button>
                        )}
                        <Button variant="primary" icon={Plus} onClick={() => setIsAddProductModalOpen(true)}>Novo produto</Button>
                    </>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Itens em estoque" value={`${inventoryStats.totalItems.toLocaleString("pt-BR")} un`} icon={Layers} tone="info" hint={`${products.length} produtos cadastrados`} />
                <StatCard label="Valor de venda" value={formatBRL(inventoryStats.totalValue)} icon={DollarSign} tone="success" hint="Preço × quantidade em estoque" />
                <StatCard label="Custo do estoque" value={formatBRL(inventoryStats.totalCost)} icon={FileText} hint="Com base no preço de custo" />
                <StatCard label="Precisam de reposição" value={inventoryStats.criticalAlerts} icon={AlertCircle} tone="danger"
                    hint={`${inventoryStats.outOfStock} esgotados`}
                    active={isReplenishmentMode}
                    onClick={() => setIsReplenishmentMode(!isReplenishmentMode)} />
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="space-y-3 border-b border-line p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                            {categories.map(c => {
                                const Icon = c.icon;
                                const active = selectedCategory === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCategory(c.id)}
                                        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-hover text-fg" : "text-fg-subtle hover:bg-hover/70 hover:text-fg"}`}
                                    >
                                        <Icon size={15} className={active ? "text-primary" : ""} />
                                        {c.label}
                                        <span className="text-xs text-fg-faint tabular">{countByCategory(c.id)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-2">
                            <SearchInput icon={Search} value={searchTerm} onChange={setSearchTerm} placeholder="Nome, marca, modelo ou código..." className="flex-1 lg:w-80" />
                            <Button icon={TriangleAlert} onClick={() => setIsReplenishmentMode(!isReplenishmentMode)}
                                className={isReplenishmentMode ? "!border-danger !text-danger" : ""}>
                                <span className="hidden sm:inline">{isReplenishmentMode ? "Mostrando reposição" : "Reposição"}</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {filteredProducts.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title="Nenhum produto encontrado"
                        description={products.length === 0 ? "Cadastre o primeiro produto para começar a controlar o estoque." : "Ajuste a busca, a categoria ou o filtro de reposição."}
                        action={products.length === 0 && <Button variant="primary" icon={Plus} onClick={() => setIsAddProductModalOpen(true)}>Novo produto</Button>}
                    />
                ) : (
                    <>
                        {/* Mobile */}
                        <ul className="divide-y divide-line md:hidden">
                            {filteredProducts.map((p) => (
                                <li key={p.id} className="flex items-start gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-fg">{p.name}</p>
                                        <p className="text-xs text-fg-subtle">{[p.brand, p.model].filter(Boolean).join(" · ")}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            {stockBadge(p)}
                                            <span className="text-sm font-semibold text-fg tabular">{formatBRL(p.price)}</span>
                                        </div>
                                    </div>
                                    <div className="flex">
                                        <IconButton icon={Printer} label="Adicionar à fila de etiquetas" onClick={() => handleAddToLabelQueue(p)} />
                                        <IconButton icon={Edit} label="Editar" onClick={() => { setSelectedProduct(p); setIsEditStockModalOpen(true); }} />
                                        <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDeleteProduct(p.id, p.name)} />
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {/* Desktop */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{sortHeader("name", "Produto")}</th>
                                        <th>Código</th>
                                        <th className="!text-center">Mínimo</th>
                                        <th>{sortHeader("stock", "Estoque")}</th>
                                        <th className="!text-right">Custo</th>
                                        <th className="!text-right">{sortHeader("price", "Preço", "right")}</th>
                                        <th className="!text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map((p) => (
                                        <tr key={p.id} className="group">
                                            <td>
                                                <p className="font-medium text-fg">{p.name}</p>
                                                <p className="text-xs text-fg-subtle">{[p.brand, p.model].filter(Boolean).join(" · ") || "—"}</p>
                                            </td>
                                            <td className="font-mono text-xs text-fg-subtle">{p.barcode || "—"}</td>
                                            <td className="text-center tabular">{p.minStock}</td>
                                            <td>{stockBadge(p)}</td>
                                            <td className="text-right tabular text-fg-subtle">{p.costPrice ? formatBRL(Number(p.costPrice)) : "—"}</td>
                                            <td className="text-right font-semibold text-fg tabular">{formatBRL(p.price)}</td>
                                            <td>
                                                <div className="flex justify-end gap-0.5">
                                                    <IconButton icon={Printer} label="Adicionar à fila de etiquetas" tone="primary" onClick={() => handleAddToLabelQueue(p)} />
                                                    <IconButton icon={Edit} label="Editar" onClick={() => { setSelectedProduct(p); setIsEditStockModalOpen(true); }} />
                                                    <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDeleteProduct(p.id, p.name)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="border-t border-line px-4 py-3 text-xs text-fg-subtle">
                            Mostrando {filteredProducts.length} de {products.length} produtos
                        </div>
                    </>
                )}
            </Card>

            {isPrintConfigOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setIsPrintConfigOpen(false)}>
                    <div className="w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-line px-5 py-4">
                            <h3 className="text-base font-semibold text-fg">Imprimir etiquetas</h3>
                            <p className="mt-0.5 text-sm text-fg-subtle">{totalLabelsInQueue} etiquetas na fila. Escolha onde começar na folha.</p>
                        </div>
                        <div className="p-5">
                            <label className="ui-label" htmlFor="startpos">Posição inicial (1 a 48)</label>
                            <input
                                id="startpos"
                                type="number"
                                min={1}
                                max={48}
                                value={startPosition}
                                onChange={(e) => setStartPosition(Number(e.target.value))}
                                className="ui-input"
                            />
                            <p className="mt-2 text-xs text-fg-subtle">Útil para reaproveitar folhas já usadas parcialmente.</p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
                            <Button variant="ghost" onClick={() => setLabelQueue([])}>Limpar fila</Button>
                            <Button onClick={() => setIsPrintConfigOpen(false)}>Cancelar</Button>
                            <Button variant="primary" icon={Printer} onClick={() => { setIsPrintConfigOpen(false); exportMixedLabelsPDF(); }}>Gerar PDF</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modais */}
            <AddProductModal
                isOpen={isAddProductModalOpen}
                onClose={() => setIsAddProductModalOpen(false)}
                onSubmit={loadProducts}
                storeEmail={effectiveStoreEmail}
            />

            {selectedProduct && (
                <EditStockModal
                    isOpen={isEditStockModalOpen}
                    onClose={() => { setIsEditStockModalOpen(false); setSelectedProduct(null); }}
                    product={selectedProduct}
                    onSubmit={handleUpdateProduct}
                />
            )}

            <LabelActionModal
                isOpen={isLabelModalOpen}
                onClose={() => { setIsLabelModalOpen(false); setProductPendingLabel(null); }}
                product={productPendingLabel}
                onConfirm={(qty, updatedData) => {
                    if (productPendingLabel) {
                        handleAddToLabelQueue(productPendingLabel, qty, updatedData);
                    }
                }}
            />
        </Page>
    );
}
