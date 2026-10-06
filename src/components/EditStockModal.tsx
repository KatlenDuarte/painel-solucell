import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import { Package, Plus, Minus, AlertTriangle, BellRing, Scan, RefreshCw, Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  stock: number;
  minStock: number;
  price: number;
  costPrice?: number | null;
  barcode?: string | null;
}

interface EditStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSubmit: (
    productId: string,
    newStock: number,
    operation: "add" | "remove" | "set",
    newName: string,
    newPrice: number,
    newMinStock: number,
    newCostPrice: number | null,
    newBarcode: string | null
  ) => void;
}

export default function EditStockModal({
  isOpen,
  onClose,
  product,
  onSubmit,
}: EditStockModalProps) {
  const [operation, setOperation] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState<string>("0");
  const [newStock, setNewStock] = useState<number>(0);

  const [newName, setNewName] = useState<string>("");
  const [newPrice, setNewPrice] = useState<string>("0");
  const [newMinStock, setNewMinStock] = useState<string>("0"); 
  const [newCostPrice, setNewCostPrice] = useState<string>("0");
  const [newBarcode, setNewBarcode] = useState<string>(""); 
  const [printQuantity, setPrintQuantity] = useState<string>("1");

  const hiddenSvgRef = useRef<SVGSVGElement>(null);

  // 🌟 CORREÇÃO CRUCIAL: Inicializa os dados do formulário APENAS quando o produto muda de ID
  useEffect(() => {
    if (!product) return;

    setNewName(product.name);
    setNewPrice(String(product.price));
    setNewMinStock(String(product.minStock)); 
    setNewCostPrice(product.costPrice ? String(product.costPrice) : "0");
    setNewBarcode(product.barcode || ""); 
    setPrintQuantity(String(product.stock > 0 ? product.stock : 1));
    setQuantity("0");
    setOperation("add");
  }, [product?.id]); // Usando apenas o ID impede que o React resete seus campos digitados/gerados

  // Re-calcula o estoque futuro de forma isolada sem resetar os inputs de texto
  useEffect(() => {
    if (!product) return;

    const q = Number(quantity);
    let result = product.stock;

    if (operation === "add") result = product.stock + q;
    if (operation === "remove") result = product.stock - q;
    if (operation === "set") result = q;

    if (result < 0) result = 0;

    setNewStock(result);
  }, [quantity, operation, product?.stock]);

  if (!product) return null;

  const currentMinLimit = Number(newMinStock);
  const isLowStock = newStock > 0 && newStock <= currentMinLimit;
  const isCritical = newStock === 0;

  // ✅ GERAR CÓDIGO DE BARRAS ALEATÓRIO (Agora segura o valor no estado)
  const handleGenerateRandomBarcode = () => {
    const randomCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setNewBarcode(randomCode);
  };

  // ✅ IMPRIMIR AS ETIQUETAS COM QUANTIDADE PERSONALIZADA
  const handlePrintLabels = () => {
    if (!newBarcode) {
      alert("Por favor, digite ou gere um código de barras antes de imprimir.");
      return;
    }

    if (hiddenSvgRef.current) {
      const format = newBarcode.length === 13 ? "EAN13" : "CODE128";
      try {
        JsBarcode(hiddenSvgRef.current, newBarcode, {
          format: format,
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 16,
          lineColor: "#000"
        });
      } catch (e) {
        JsBarcode(hiddenSvgRef.current, newBarcode, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 16,
          lineColor: "#000"
        });
      }
    }

    const svgString = new XMLSerializer().serializeToString(hiddenSvgRef.current!);
    const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
    
    const totalLabels = Number(printQuantity) || 1;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Bloqueador de pop-ups ativo! Permita pop-ups para conseguir imprimir.");
      return;
    }

    const labelsHtmlArray = Array.from({ length: totalLabels }).map(() => `
      <div class="card">
        <div class="title">${newName || "Produto Sem Nome"}</div>
        <img class="barcode-img" src="${svgBase64}" />
        <div class="price">${newPrice ? `R$ ${Number(newPrice).toFixed(2)}` : ""}</div>
      </div>
    `).join('');

    const labelHTML = `
      <html>
        <head>
          <title>Imprimir Etiqueta - ${newName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; padding: 0; background: #fff; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
            .card { border: 1px dashed #bbb; padding: 10px; text-align: center; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; }
            .title { font-size: 11px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #000; }
            .price { font-size: 13px; font-weight: bold; margin-top: 2px; color: #000; }
            .barcode-img { max-width: 160px; height: auto; display: block; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="grid">
            ${labelsHtmlArray}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(labelHTML);
    printWindow.document.close();
  };

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const q = Number(quantity);
    const updatedPrice = Number(newPrice);
    const updatedMinStock = Number(newMinStock); 
    const updatedCostPrice = newCostPrice !== "" ? Number(newCostPrice) : null;
    
    // 🌟 CORREÇÃO AQUI: Não force "|| null" se o input tiver texto. 
    // Garanta que envie a string limpa. Se estiver vazia, envia "" ou null de forma explícita.
    const updatedBarcode = newBarcode.trim() !== "" ? newBarcode.trim() : null; 

    if (operation === "remove" && q > product.stock) {
      alert("Você não pode remover mais do que o estoque atual!");
      return;
    }

    // Certifique-se de que todos esses parâmetros batem com a ordem esperada no Componente Pai
    onSubmit(
      product.id, 
      newStock, 
      operation, 
      newName, 
      updatedPrice, 
      updatedMinStock, 
      updatedCostPrice, 
      updatedBarcode // 🏷️ O código de barras editado/gerado vai aqui
    );
    
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Produto & Estoque" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        <div style={{ display: "none" }}>
          <svg ref={hiddenSvgRef}></svg>
        </div>

        {/* INFO DO PRODUTO */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-slate-50 font-semibold text-lg">{newName}</h3>
              <p className="text-slate-400 text-sm">{product.brand} - {product.model}</p>
              
              <div className="mt-2 flex items-center gap-6">
                <div>
                  <p className="text-slate-500 text-xs">Estoque Atual</p>
                  <p className="text-slate-50 font-bold text-xl">{product.stock}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Mínimo Atual</p>
                  <p className="text-amber-500 font-bold text-xl">{product.minStock}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Preço Unitário</p>
                  <p className="text-emerald-400 font-bold text-xl">R$ {Number(newPrice).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CAMPOS DE EDIÇÃO DE DETALHES */}
        <div className="space-y-4 pt-2 pb-4 border-b border-slate-800">
          <h4 className="text-sm font-bold text-slate-500">Configurações do Produto</h4>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome do Produto</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Custo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:border-blue-500 outline-none transition-all"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Preço (R$)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <BellRing size={14} className="text-amber-400" /> Estoque Mínimo
              </label>
              <input
                type="number"
                required
                min="0"
                value={newMinStock}
                onChange={(e) => setNewMinStock(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:border-amber-500 outline-none transition-all"
                placeholder="Ex: 5"
              />
            </div>
          </div>

          {/* SECTOR CÓDIGO DE BARRAS */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código de Barras</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Bipe, digite ou gere um código..."
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateRandomBarcode}
                className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-1 transition-colors border border-slate-600 text-xs"
                title="Gerar código aleatório"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gerar</span>
              </button>
            </div>
          </div>

          {/* IMPRESSÃO DIRETA DE ETIQUETAS */}
          {newBarcode && (
            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium text-slate-400 whitespace-nowrap">Qtd. Cópias:</label>
                <input
                  type="number"
                  min="1"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-50 font-bold text-sm outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handlePrintLabels}
                className="w-full sm:w-auto px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Etiquetas</span>
              </button>
            </div>
          )}
        </div>

        {/* MOVIMENTAÇÃO DE ESTOQUE */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">Movimentação de Estoque</label>
          <div className="grid grid-cols-3 gap-3">
             <button type="button" onClick={() => setOperation("add")} className={`p-3 rounded-xl border-2 transition-all ${operation === "add" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
               <Plus className="w-5 h-5 mx-auto mb-1" />
               <span className="text-xs font-bold">Adicionar</span>
             </button>
             <button type="button" onClick={() => setOperation("remove")} className={`p-3 rounded-xl border-2 transition-all ${operation === "remove" ? "border-red-500 bg-red-500/10 text-red-400" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
               <Minus className="w-5 h-5 mx-auto mb-1" />
               <span className="text-xs font-bold">Remover</span>
             </button>
             <button type="button" onClick={() => setOperation("set")} className={`p-3 rounded-xl border-2 transition-all ${operation === "set" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
               <Package className="w-5 h-5 mx-auto mb-1" />
               <span className="text-xs font-bold">Definir</span>
             </button>
          </div>

          <input
            type="number"
            required
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-50 text-center text-2xl font-bold focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        {/* PREVIEW DO NOVO STATUS */}
        {quantity && (
          <div className={`p-4 rounded-xl border-2 ${isCritical ? "bg-red-500/10 border-red-500/30" : isLowStock ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Estoque após salvar:</span>
              <span className={`font-bold text-3xl ${isCritical ? "text-red-400" : isLowStock ? "text-amber-400" : "text-emerald-400"}`}>
                {newStock}
              </span>
            </div>

            {(isLowStock || isCritical) && (
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-700">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isCritical ? "text-red-400" : "text-amber-400"}`} />
                <p className={`text-sm ${isCritical ? "text-red-300" : "text-amber-300"}`}>
                  {isCritical ? "⚠️ Estoque zerado!" : `⚠️ Estoque ficará abaixo do mínimo (${newMinStock} un)`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* BOTÕES */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-lg transition-all font-medium">
            Cancelar
          </button>
          <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all font-medium shadow-lg">
            Salvar Alterações
          </button>
        </div>
      </form>
    </Modal>
  );
}