import React, { useState } from "react";
import Modal from "./Modal";
import {
  Package,
  Tag,
  Smartphone,
  Boxes,
  DollarSign,
  Truck,
  Save,
  X,
  Layers3,
} from "lucide-react";
import { addProduct } from "../services/productsService";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newProduct: any) => void;
  storeEmail: string | null;
}

export default function AddProductModal({
  isOpen,
  onClose,
  onSubmit,
  storeEmail,
}: AddProductModalProps) {
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
    provider: "",
  });

  const categories = [
    { id: "peliculas", name: "Películas" },
    { id: "cases", name: "Cases" },
    { id: "cabos", name: "Cabos" },
    { id: "carregadores", name: "Carregadores" },
    { id: "acessorios", name: "Acessórios" },
    { id: "fone", name: "Fone" },
    { id: "caixa", name: "Caixa de Som" },
    { id: "outros", name: "Outros" },
  ];

  const brands = [
    "Apple",
    "Samsung",
    "Xiaomi",
    "Motorola",
    "LG",
    "Asus",
    "Universal",
    "A'gold",
    "H'maston",
    "Outros",
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

  const isModelRequired = () =>
    ["peliculas", "cases", "cabos", "carregadores"].includes(formData.category);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
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
      provider: "",
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeEmail) {
      alert("Erro de autenticação: E-mail da loja indisponível.");
      return;
    }

    const finalBrand =
      formData.brand === "Outros"
        ? formData.customBrand.trim()
        : formData.brand.trim();

    if (!finalBrand) {
      alert("Informe a marca do produto.");
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        nameLower: formData.name.trim().toLowerCase(),

        category: formData.category,

        brand: finalBrand,
        brandLower: finalBrand.toLowerCase(),

        model: formData.model.trim(),
        modelLower: formData.model.trim().toLowerCase(),

        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
        price: Number(formData.price),
        costPrice: formData.costPrice !== "" ? Number(formData.costPrice) : null,

        provider: formData.provider.trim() || null,
        providerLower: formData.provider.trim()
          ? formData.provider.trim().toLowerCase()
          : null,
      };

      const newProduct = await addProduct(productData, storeEmail);

      resetForm();
      onClose();

      if (onSubmit) {
        onSubmit(newProduct);
      }
    } catch (err) {
      console.error("Erro ao adicionar produto:", err);
      alert("Erro ao adicionar produto. Verifique o console.");
    }
  };

  const finalBrandPreview =
    formData.brand === "Outros" ? formData.customBrand : formData.brand;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adicionar" size="xl">
      <form
        onSubmit={handleSubmit}
        className="bg-[#020617] text-slate-200 p-4 sm:p-5 space-y-4"
      >
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                Cadastro de item
              </p>

              <h3 className="text-white font-black text-sm sm:text-base leading-tight truncate">
                {formData.name || "Adicionar produto ao estoque"}
              </h3>

              <p className="text-slate-500 text-xs mt-1 truncate">
                {finalBrandPreview || "Marca"} • {formData.model || "Modelo"}
              </p>
            </div>
          </div>
        </div>

        <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-4">
          <SectionTitle
            icon={<Layers3 size={15} />}
            title="Informações principais"
          />

          <InputField
            icon={<Package size={17} />}
            label="Nome do Produto"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="Ex: Película iPhone 14 Pro"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField
              label="Categoria"
              name="category"
              required
              value={formData.category}
              onChange={handleChange}
              options={categories}
            />

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Marca *
              </label>

              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <select
                  required
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Selecione</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.brand === "Outros" ? (
              <InputField
                icon={<Tag size={17} />}
                label="Nova Marca"
                name="customBrand"
                required
                value={formData.customBrand}
                onChange={handleChange}
                placeholder="Digite a marca"
              />
            ) : (
              <InputField
                icon={<Truck size={17} />}
                label="Fornecedor"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                placeholder="Ex: Distribuidora BH"
              />
            )}
          </div>

          {formData.brand === "Outros" && (
            <InputField
              icon={<Truck size={17} />}
              label="Fornecedor"
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              placeholder="Xavante..."
            />
          )}

          <InputField
            icon={<Smartphone size={17} />}
            label={`${getModelLabel()} ${isModelRequired() ? "*" : ""}`}
            name="model"
            required={isModelRequired()}
            value={formData.model}
            onChange={handleChange}
            placeholder={getModelPlaceholder()}
          />
        </section>

        <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-4">
          <SectionTitle icon={<Boxes size={15} />} title="Estoque e valores" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <SimpleInput
              label="Estoque"
              name="stock"
              type="number"
              required
              min="0"
              value={formData.stock}
              onChange={handleChange}
              placeholder="0"
            />

            <SimpleInput
              label="Estoque Mínimo"
              name="minStock"
              type="number"
              required
              min="0"
              value={formData.minStock}
              onChange={handleChange}
              placeholder="5"
            />

            <SimpleInput
              label="Preço de Custo"
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              value={formData.costPrice}
              onChange={handleChange}
              placeholder="0,00"
              icon={<DollarSign size={15} />}
            />

            <SimpleInput
              label="Preço de Venda"
              name="price"
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handleChange}
              placeholder="0,00"
              icon={<DollarSign size={15} />}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all font-black text-xs uppercase"
          >
            <X size={16} />
            Cancelar
          </button>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all font-black text-xs uppercase shadow-lg shadow-emerald-500/10"
          >
            <Save size={16} />
            Adicionar Produto
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
        {icon}
      </div>

      <h4 className="text-sm font-black text-white">{title}</h4>
    </div>
  );
}

function InputField({
  icon,
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
}: any) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
        {label}
      </label>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </span>

        <input
          type="text"
          name={name}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
}: any) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
        {label} {required && "*"}
      </label>

      <select
        required={required}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
      >
        {options.map((option: any) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function SimpleInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
  step,
  icon,
}: any) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
        {label} {required && "*"}
      </label>

      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            {icon}
          </span>
        )}

        <input
          type={type}
          name={name}
          required={required}
          min={min}
          step={step}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-slate-950/80 border border-slate-800 rounded-xl ${
            icon ? "pl-11" : "px-4"
          } pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors`}
        />
      </div>
    </div>
  );
}