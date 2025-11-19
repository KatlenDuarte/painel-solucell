// src/components/AddProductModal.tsx

import React, { useState } from "react";
import Modal from "./Modal";
import { Package, Tag, Smartphone } from "lucide-react";
import { addProduct } from "../services/productsService";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  // O onSubmit agora recebe o produto final para atualizar o estado do componente pai
  onSubmit: (newProduct: any) => void;
  // NOVO: Recebe o e-mail do usuário logado (storeEmail)
  storeEmail: string | null;
}

// NOVO: Adicione storeEmail aos props
export default function AddProductModal({ isOpen, onClose, onSubmit, storeEmail }: AddProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "peliculas",
    brand: "",
    model: "",
    stock: "",
    minStock: "",
    price: "",
    costPrice: ""
  });

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

  const brands = [
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🛑 Verifica se o e-mail da loja foi passado
    if (!storeEmail) {
      alert("Erro de autenticação: E-mail da loja indisponível.");
      console.error("storeEmail é nulo. Produto não adicionado.");
      return;
    }

    try {
      // Prepara os dados, garantindo que números sejam números e aplicando a CORREÇÃO
      const productData = {
        ...formData,
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        price: Number(formData.price),
        // 💡 CORREÇÃO: Verifica se NÃO é string vazia antes de converter, para permitir o valor 0
        costPrice: formData.costPrice !== "" ? Number(formData.costPrice) : null,
      };

      // CRÍTICO: Chama o service passando os dados E o storeEmail
      const newProduct = await addProduct(productData, storeEmail);

      // Limpa e fecha o modal
      setFormData({
        name: "",
        category: "peliculas",
        brand: "",
        model: "",
        stock: "",
        minStock: "",
        price: "",
        costPrice: ""
      });
      onClose();

      // Notifica o componente pai com o produto final (que já tem o ID do Firestore)
      if (onSubmit) {
        onSubmit(newProduct);
      }

    } catch (err) {
      console.error("Erro ao adicionar produto:", err);
      alert("Erro ao adicionar produto. Verifique o console para mais detalhes.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Novo Produto" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Nome */}
        <div>
          <label className="block text-sm text-slate-300 mb-2">Nome do Produto *</label>
          <div className="relative">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              name="name" // Adicionado
              required
              value={formData.name}
              onChange={handleChange} // Usando handleChange
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              placeholder="Ex: Película iPhone 14 Pro"
            />
          </div>
        </div>

        {/* Categoria e Marca */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Categoria *</label>
            <select
              required
              name="category" // Adicionado
              value={formData.category}
              onChange={handleChange} // Usando handleChange
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Marca *</label>
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                required
                name="brand" // Adicionado
                value={formData.brand}
                onChange={handleChange} // Usando handleChange
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="">Selecione a marca</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
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
              name="model" // Adicionado
              required={isModelRequired()}
              value={formData.model}
              onChange={handleChange} // Usando handleChange
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              placeholder={getModelPlaceholder()}
            />
          </div>
        </div>

        {/* Estoque e Preço */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Estoque *</label>
            <input
              type="number"
              name="stock" // Adicionado
              required
              min="0"
              value={formData.stock}
              onChange={handleChange} // Usando handleChange
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Estoque Mínimo *</label>
            <input
              type="number"
              name="minStock" // Adicionado
              required
              min="0"
              value={formData.minStock}
              onChange={handleChange} // Usando handleChange
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Preço de Custo</label>
            <input
              type="number"
              name="costPrice" // Adicionado
              min="0"
              step="0.01"
              value={formData.costPrice}
              onChange={handleChange} // Usando handleChange
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Preço de Venda *</label>
            <input
              type="number"
              name="price" // Adicionado
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleChange} // Usando handleChange
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancelar</button>
          <button type="submit" className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">Adicionar Produto</button>
        </div>
      </form>
    </Modal>
  );
}