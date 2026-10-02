import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  Save,
  X,
  DollarSign,
  Boxes,
  Pencil,
  Truck,
  ShieldAlert,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  stock: number;
  minStock: number;
  price: number;
  provider?: string | null;
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
    newProvider: string | null
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
  const [newProvider, setNewProvider] = useState<string>("");

  useEffect(() => {
    if (!product) return;

    setNewName(product.name || "");
    setNewPrice(String(product.price || 0));
    setNewMinStock(String(product.minStock || 0));
    setNewProvider(product.provider || "");
    setQuantity("0");
    setOperation("add");
    setNewStock(product.stock || 0);
  }, [product]);

  useEffect(() => {
    if (!product) return;

    const q = Number(quantity || 0);
    let result = product.stock;

    if (operation === "add") result = product.stock + q;
    if (operation === "remove") result = product.stock - q;
    if (operation === "set") result = q;

    if (result < 0) result = 0;

    setNewStock(result);
  }, [quantity, operation, product]);

  if (!product) return null;

  const minStockNumber = Number(newMinStock || 0);
  const isLowStock = newStock > 0 && newStock < minStockNumber;
  const isCritical = newStock === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const q = Number(quantity || 0);
    const updatedPrice = Number(newPrice || 0);
    const updatedMinStock = Number(newMinStock || 0);
    const providerValue = newProvider.trim() || null;

    if (!newName.trim()) {
      alert("Informe o nome do produto.");
      return;
    }

    if (updatedPrice < 0) {
      alert("O preço não pode ser negativo.");
      return;
    }

    if (updatedMinStock < 0) {
      alert("A quantidade mínima não pode ser negativa.");
      return;
    }

    if (operation === "remove" && q > product.stock) {
      alert("Você não pode remover mais do que o estoque atual!");
      return;
    }

    onSubmit(
      product.id,
      newStock,
      operation,
      newName.trim(),
      updatedPrice,
      updatedMinStock,
      providerValue
    );

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar" size="xl">
      <form
        onSubmit={handleSubmit}
        className="bg-[#020617] text-slate-200 p-4 sm:p-5 space-y-4"
      >
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-start gap-3">

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                Produto selecionado
              </p>

              <h3 className="text-white font-black text-sm sm:text-base leading-tight truncate mt-0.5">
                {newName || product.name}
              </h3>

              <p className="text-slate-500 text-xs mt-1 truncate">
                {product.brand} • {product.model}
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                <MiniStat
                  icon={<Boxes size={15} />}
                  label="Estoque atual"
                  value={`${product.stock} un`}
                  color="blue"
                />

                <MiniStat
                  icon={<ShieldAlert size={15} />}
                  label="Mínimo atual"
                  value={`${product.minStock} un`}
                  color="amber"
                />

                <MiniStat
                  icon={<DollarSign size={15} />}
                  label="Preço atual"
                  value={`R$ ${Number(product.price || 0).toFixed(2)}`}
                  color="emerald"
                />

                <MiniStat
                  icon={<Truck size={15} />}
                  label="Fornecedor"
                  value={product.provider || "Não informado"}
                  color="slate"
                />
              </div>
            </div>
          </div>
        </div>

        <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-4">
          <SectionTitle
            icon={<Pencil size={15} />}
            title="Detalhes do Produto"
            description="Edite nome, preço, estoque mínimo e fornecedor."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <InputField
              label="Nome do Produto"
              value={newName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewName(e.target.value)
              }
              required
            />

            <InputField
              label="Fornecedor"
              value={newProvider}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewProvider(e.target.value)
              }
              placeholder="Ex: Distribuidora BH, Shopee..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField
              label="Preço Unitário"
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewPrice(e.target.value)
              }
              required
            />

            <InputField
              label="Estoque Mínimo"
              type="number"
              min="0"
              value={newMinStock}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewMinStock(e.target.value)
              }
              required
            />
          </div>
        </section>

        <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-4">
          <SectionTitle
            title="Movimentação de Estoque"
            description="Escolha se deseja adicionar, remover ou definir o estoque total."
          />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <OperationButton
              active={operation === "add"}
              color="emerald"
              icon={<Plus size={18} />}
              label="Adicionar"
              onClick={() => setOperation("add")}
            />

            <OperationButton
              active={operation === "remove"}
              color="red"
              icon={<Minus size={18} />}
              label="Remover"
              onClick={() => setOperation("remove")}
            />

            <OperationButton
              active={operation === "set"}
              color="blue"
              icon={<Package size={18} />}
              label="Definir"
              onClick={() => setOperation("set")}
            />
          </div>

          <InputField
            label={
              operation === "set"
                ? "Nova quantidade total"
                : "Quantidade de movimentação"
            }
            type="number"
            min="0"
            value={quantity}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setQuantity(e.target.value)
            }
            required
            center
            large
            placeholder="0"
          />
        </section>

        <div
          className={`rounded-2xl border p-4 ${
            isCritical
              ? "bg-red-500/10 border-red-500/30"
              : isLowStock
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Novo estoque
              </p>

              <p
                className={`text-3xl sm:text-4xl font-black ${
                  isCritical
                    ? "text-red-400"
                    : isLowStock
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {newStock}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] text-slate-500">Novo mínimo</p>
              <p className="text-white font-black">{minStockNumber} un</p>
            </div>
          </div>

          {(isLowStock || isCritical) && (
            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-slate-800/80">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${
                  isCritical ? "text-red-400" : "text-amber-400"
                }`}
              />

              <p
                className={`text-xs sm:text-sm ${
                  isCritical ? "text-red-300" : "text-amber-300"
                }`}
              >
                {isCritical
                  ? "Estoque zerado. Produto indisponível para venda."
                  : `Estoque abaixo do mínimo recomendado de ${minStockNumber} unidades.`}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
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
            Salvar Alteração
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
          {icon}
        </div>
      )}

      <div>
        <h4 className="text-sm font-black text-white">{title}</h4>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  step,
  placeholder,
  center = false,
  large = false,
}: any) {
  return (
    <div>
      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
        {label} {required && "*"}
      </label>

      <input
        type={type}
        required={required}
        min={min}
        step={step}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors ${
          center ? "text-center" : ""
        } ${large ? "text-2xl sm:text-3xl font-black" : "text-sm"}`}
      />
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "emerald" | "amber" | "slate";
}) {
  const colorClass =
    color === "blue"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : color === "emerald"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : color === "amber"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <span className={`p-1 rounded-lg border ${colorClass}`}>
          {icon}
        </span>

        <span className="text-[9px] uppercase font-black tracking-wider truncate">
          {label}
        </span>
      </div>

      <p className="text-white font-black text-sm truncate">{value}</p>
    </div>
  );
}

function OperationButton({
  active,
  color,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  color: "emerald" | "red" | "blue";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const activeClass =
    color === "emerald"
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
      : color === "red"
      ? "border-red-500 bg-red-500/10 text-red-400"
      : "border-blue-500 bg-blue-500/10 text-blue-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-2xl border transition-all ${
        active
          ? activeClass
          : "border-slate-800 bg-slate-950/70 text-slate-500 hover:bg-slate-800/60"
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-1.5">
        {icon}

        <span className="text-[10px] sm:text-xs font-black uppercase">
          {label}
        </span>
      </div>
    </button>
  );
}