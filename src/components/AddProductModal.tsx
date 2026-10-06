import React, { useState, useRef } from "react";
import Modal from "./Modal.tsx";
import { Package, Tag, Smartphone, Scan, Truck, RefreshCw, Printer } from "lucide-react"; 
import { addProduct } from "../services/productsService";

// IMPORTANTE: Vamos usar a biblioteca JsBarcode instalada no seu projeto
// Se não tiver instalado, rode: npm install jsbarcode
import JsBarcode from "jsbarcode";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newProduct: any) => void;
  storeEmail: string | null;
}

export default function AddProductModal({ isOpen, onClose, onSubmit, storeEmail }: AddProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "peliculas",
    brand: "",
    customBrand: "",
    model: "",
    stock: "",
    minStock: "",
    price: "",
    costPrice: "",
    barcode: "",
    provider: "",
  });

  const [isNewBrandMode, setIsNewBrandMode] = useState(false);
  
  // Ref para criarmos um elemento oculto que vai gerar a imagem do código de barras
  const hiddenSvgRef = useRef<SVGSVGElement>(null);

  const categories = [
    { id: "peliculas", name: "Películas" },
    { id: "cases", name: "Cases" },
    { id: "cabos", name: "Cabos" },
    { id: "carregadores", name: "Carregadores" },
    { id: "acessorios", name: "Acessórios" },
    { id: "fone", name: "Fone" },
    { id: "caixa", name: "Caixa de Som" },
    { id: "outros", name: "Outros" }
  ];

  const defaultBrands = [
    "Apple", "Samsung", "Xiaomi", "Motorola", "LG", "Asus", "Universal", "A'gold", "H'maston", "Outros"
  ];

  const getModelLabel = () => {
    if (formData.category === "cabos") return "Tipo do Cabo";
    if (formData.category === "carregadores") return "Tipo do Carregador";
    return "Modelo";
  };

  const getModelPlaceholder = () => {
    if (formData.category === "cabos") return "Ex: USB-C, V8, Lightning";
    if (formData.category === "carregadores") return "Ex: Turbo, USB-C, iPhone";
    return "Ex: iPhone 14 Pro, Galaxy S23";
  };

  const isModelRequired = () => ["peliculas", "cases", "cabos", "carregadores"].includes(formData.category);

  // 1. GERAR CÓDIGO DE BARRAS ALEATÓRIO
  const handleGenerateRandomBarcode = () => {
    const randomCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomCode }));
  };

  // 2. IMPRIMIR AS ETIQUETAS USANDO IMAGEM ESTÁTICA (SEM TRAVAMENTO E SEM SUMIR)
  const handlePrintLabels = () => {
    if (!formData.barcode) {
      alert("Por favor, gere ou digite um código de barras antes de imprimir.");
      return;
    }

    // Força a renderização do código de barras no nosso SVG oculto do DOM do React
    if (hiddenSvgRef.current) {
      const format = formData.barcode.length === 13 ? "EAN13" : "CODE128";
      try {
        JsBarcode(hiddenSvgRef.current, formData.barcode, {
          format: format,
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 16,
          lineColor: "#000"
        });
      } catch (e) {
        // Fallback caso o EAN13 falhe por validação de dígito verificador
        JsBarcode(hiddenSvgRef.current, formData.barcode, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 16,
          lineColor: "#000"
        });
      }
    }

    // Convertemos o SVG gerado em uma String Base64 segura que o navegador lê instantaneamente
    const svgString = new XMLSerializer().serializeToString(hiddenSvgRef.current!);
    const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));

    const quantity = Number(formData.stock) || 1;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Bloqueador de pop-ups ativo! Permita pop-ups neste site para conseguir imprimir.");
      return;
    }

    // Criamos o HTML repetindo a imagem estática gerada (carrega na hora!)
    const labelsHtmlArray = Array.from({ length: quantity }).map(() => `
      <div class="card">
        <div class="title">${formData.name || "Produto Sem Nome"}</div>
        <img class="barcode-img" src="${svgBase64}" />
        <div class="price">${formData.price ? `R$ ${Number(formData.price).toFixed(2)}` : ""}</div>
      </div>
    `).join('');

    const labelHTML = `
      <html>
        <head>
          <title>Imprimir Etiqueta - ${formData.name}</title>
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
              // Como a imagem já está injetada em Base64, ela já está pronta. Pode imprimir direto!
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "brand" && value === "NEW_BRAND") {
      setIsNewBrandMode(true);
      setFormData(prev => ({ ...prev, brand: "", customBrand: "" }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancelNewBrand = () => {
    setIsNewBrandMode(false);
    setFormData(prev => ({ ...prev, brand: "", customBrand: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeEmail) {
      alert("Erro de autenticação: E-mail da loja indisponível.");
      return;
    }

    const finalBrand = isNewBrandMode ? formData.customBrand.trim() : formData.brand;

    if (!finalBrand) {
      alert("Por favor, selecione ou digite uma marca válida.");
      return;
    }

    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        brand: finalBrand,
        model: formData.model,
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        price: Number(formData.price),
        costPrice: formData.costPrice !== "" ? Number(formData.costPrice) : null,
        barcode: formData.barcode.trim() || null,
        provider: formData.provider.trim() || null,
      };

      const newProduct = await addProduct(productData, storeEmail);

      setFormData({
        name: "",
        category: "peliculas",
        brand: "",
        customBrand: "",
        model: "",
        stock: "",
        minStock: "",
        price: "",
        costPrice: "",
        barcode: "",
        provider: "",
      });
      setIsNewBrandMode(false);
      onClose();

      if (onSubmit) {
        onSubmit(newProduct);
      }

    } catch (err) {
      console.error("Erro ao adicionar produto:", err);
      alert("Erro ao adicionar produto. Verifique o console.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Novo Produto" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* ELEMENTO SVG INVISÍVEL NO DOM DO REACT APENAS PARA GERAR O BASE64 */}
        <div style={{ display: "none" }}>
          <svg ref={hiddenSvgRef}></svg>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">Nome do Produto *</label>
          <div className="relative">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="Ex: Película iPhone 14 Pro"
            />
          </div>
        </div>

        {/* CÓDIGO DE BARRAS */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">Código de Barras (Opcional) 🏷️</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                placeholder="Bipe, digite ou gere um código..."
              />
            </div>
            
            {/* Botão de Gerar Código */}
            <button
              type="button"
              onClick={handleGenerateRandomBarcode}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-2 transition-colors border border-slate-600"
              title="Gerar código aleatório"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Gerar</span>
            </button>

            {/* Botão de Imprimir */}
            {formData.barcode && (
              <button
                type="button"
                onClick={handlePrintLabels}
                className="px-4 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 transition-colors"
                title="Imprimir Etiquetas"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Imprimir (${formData.stock || 0})</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-1">
            Insira o <strong>Estoque</strong> desejado abaixo, gere ou bipe o código e clique em <strong>Imprimir</strong> para gerar as etiquetas físicas.
          </p>
        </div>

        {/* Categoria e Marca */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Categoria *</label>
            <select
              required
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Marca *</label>
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              
              {!isNewBrandMode ? (
                <select
                  required
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione a marca</option>
                  {defaultBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value="NEW_BRAND" className="text-emerald-400 font-bold">+ Cadastrar Nova Marca</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="customBrand"
                    required
                    value={formData.customBrand}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-emerald-500/50 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Digite a nova marca..."
                  />
                  <button 
                    type="button" 
                    onClick={handleCancelNewBrand}
                    className="px-3 bg-slate-700 hover:bg-slate-600 text-xs rounded-lg text-slate-300 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modelo */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">{getModelLabel()} {isModelRequired() && "*"}</label>
          <div className="relative">
            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              name="model"
              required={isModelRequired()}
              value={formData.model}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder={getModelPlaceholder()}
            />
          </div>
        </div>

        {/* Fornecedor */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">Fornecedor (Opcional)</label>
          <div className="relative">
            <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              placeholder="Ex: Distribuidora Sol, Importadora XYZ"
            />
          </div>
        </div>

        {/* Estoque e Estoque Mínimo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Estoque *</label>
            <input
              type="number"
              name="stock"
              required
              min="0"
              value={formData.stock}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Estoque Mínimo *</label>
            <input
              type="number"
              name="minStock"
              required
              min="0"
              value={formData.minStock}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Preço de Custo e Preço de Venda */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Preço de Custo</label>
            <input
              type="number"
              name="costPrice"
              min="0"
              step="0.01"
              value={formData.costPrice}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Preço de Venda *</label>
            <input
              type="number"
              name="price"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Botões do Formulário */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-lg transition-colors">Cancelar</button>
          <button type="submit" className="flex-1 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-colors">Adicionar Produto</button>
        </div>
      </form>
    </Modal>
  );
}