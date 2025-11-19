import React, { useState, useEffect } from "react"
import Modal from "./Modal"
import { Package, Plus, Minus, AlertTriangle } from "lucide-react"

interface Product {
  id: string
  name: string
  brand: string
  model: string
  stock: number
  minStock: number
}

interface EditStockModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  onSubmit: (productId: string, newStock: number, operation: "add" | "remove" | "set") => void
}

export default function EditStockModal({
  isOpen,
  onClose,
  product,
  onSubmit,
}: EditStockModalProps) {
  const [operation, setOperation] = useState<"add" | "remove" | "set">("add")
  const [quantity, setQuantity] = useState<string>("0")
  const [newStock, setNewStock] = useState<number>(0)

  useEffect(() => {
    if (!product) return

    const q = Number(quantity)
    let result = product.stock

    if (operation === "add") result = product.stock + q
    if (operation === "remove") result = product.stock - q
    if (operation === "set") result = q

    if (result < 0) result = 0

    setNewStock(result)
  }, [quantity, operation, product])

  if (!product) return null

  const isLowStock = newStock > 0 && newStock < product.minStock
  const isCritical = newStock === 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const q = Number(quantity)

    if (operation === "remove" && q > product.stock) {
      alert("Você não pode remover mais do que o estoque atual!")
      return
    }

    // ✅ CORRETO — envia os dados certos para atualização no Firebase
    onSubmit(product.id, newStock, operation)

    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Estoque" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* INFO DO PRODUTO */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg">{product.name}</h3>
              <p className="text-slate-400 text-sm">
                {product.brand} - {product.model}
              </p>
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <p className="text-slate-500 text-xs">Estoque Atual</p>
                  <p className="text-white font-bold text-xl">{product.stock}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Estoque Mínimo</p>
                  <p className="text-slate-400 font-semibold">{product.minStock}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TIPO DE OPERAÇÃO */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Tipo de Operação
          </label>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setOperation("add")}
              className={`p-4 rounded-xl border-2 transition-all ${
                operation === "add"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              }`}
            >
              <Plus
                className={`w-6 h-6 mx-auto mb-2 ${
                  operation === "add" ? "text-emerald-400" : "text-slate-400"
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  operation === "add" ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                Adicionar
              </p>
            </button>

            <button
              type="button"
              onClick={() => setOperation("remove")}
              className={`p-4 rounded-xl border-2 transition-all ${
                operation === "remove"
                  ? "border-red-500 bg-red-500/10"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              }`}
            >
              <Minus
                className={`w-6 h-6 mx-auto mb-2 ${
                  operation === "remove" ? "text-red-400" : "text-slate-400"
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  operation === "remove" ? "text-red-400" : "text-slate-400"
                }`}
              >
                Remover
              </p>
            </button>

            <button
              type="button"
              onClick={() => setOperation("set")}
              className={`p-4 rounded-xl border-2 transition-all ${
                operation === "set"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              }`}
            >
              <Package
                className={`w-6 h-6 mx-auto mb-2 ${
                  operation === "set" ? "text-blue-400" : "text-slate-400"
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  operation === "set" ? "text-blue-400" : "text-slate-400"
                }`}
              >
                Definir
              </p>
            </button>
          </div>
        </div>

        {/* QUANTIDADE */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {operation === "set" ? "Nova Quantidade Total" : "Quantidade"}
          </label>
          <input
            type="number"
            required
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-center text-2xl font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {/* PREVIEW */}
        {quantity && (
          <div
            className={`p-4 rounded-xl border-2 ${
              isCritical
                ? "bg-red-500/10 border-red-500/30"
                : isLowStock
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">Novo Estoque:</span>
              <span
                className={`font-bold text-3xl ${
                  isCritical
                    ? "text-red-400"
                    : isLowStock
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {newStock}
              </span>
            </div>

            {(isLowStock || isCritical) && (
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-700">
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 ${
                    isCritical ? "text-red-400" : "text-amber-400"
                  }`}
                />
                <p
                  className={`text-sm ${
                    isCritical ? "text-red-300" : "text-amber-300"
                  }`}
                >
                  {isCritical
                    ? "⚠️ Estoque zerado! Produto indisponível para venda."
                    : `⚠️ Estoque abaixo do mínimo recomendado (${product.minStock} unidades)`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* BOTÕES */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/20"
          >
            Confirmar Alteração
          </button>
        </div>
      </form>
    </Modal>
  )
}
