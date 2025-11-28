// src/components/ProtectedRoute.tsx

import { useState, useEffect } from "react"

// Adicionar a prop requiredPin à interface/destructuring
export default function ProtectedRoute({ isUnlocked, onUnlock, children, requiredPin }) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [attempts, setAttempts] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const LIMIT = 5
  const BLOCK_TIME = 30

  useEffect(() => {
    // ... (lógica de bloqueio por tempo) ...
    if (blocked) {
      setTimeLeft(BLOCK_TIME)
      const interval = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setBlocked(false)
            clearInterval(interval)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
  }, [blocked])

  const validatePin = (value) => {
    setPin(value)

    if (blocked) return

    if (value.length === 4) {
      // USAR A PROP requiredPin AQUI
      if (value === requiredPin) {
        onUnlock(true)
        setError("") // Limpa o erro em caso de sucesso
        setAttempts(0) // Reseta as tentativas
      } else {
        setError("PIN incorreto")
        setPin("")
        setAttempts((a) => a + 1)

        if (attempts + 1 >= LIMIT) {
          setBlocked(true)
          setError("Muitas tentativas. Acesso bloqueado temporariamente.")

          // 🔔 "NOTIFICAR ADMINISTRADOR"
          console.warn("⚠️ ALERTA: Tentativas excessivas de PIN! Admin foi notificado.")

          // Aqui você pode depois integrar:
          // • envio de email
          // • webhook para API
          // • notificação Firebase
        }
      }
    }
  }

  if (isUnlocked) return children

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl w-96 text-center animate-fadeIn">

        <h2 className="text-white text-2xl font-semibold mb-4">
          Área Restrita
        </h2>

        <p className="text-slate-400 text-sm mb-6">
          Insira o PIN para continuar
        </p>

        <input
          type="password"
          value={pin}
          disabled={blocked}
          onChange={(e) => validatePin(e.target.value)}
          maxLength={4}
          placeholder="••••"
          className={`
            w-full px-4 py-3 rounded-xl text-center text-lg tracking-[0.4em]
            outline-none transition-all duration-300 bg-slate-800/60 text-white 
            border ${error ? "border-red-500 shake" : "border-slate-700"}
            focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40
          `}
        />

        {error && (
          <p className="text-red-500 mt-3 text-sm">{error}</p>
        )}

        {blocked && (
          <p className="text-yellow-400 mt-3 text-sm">
            Tente novamente em {timeLeft}s
          </p>
        )}

        <div className="mt-6">
          <button
            disabled
            className="
              w-full py-3 rounded-xl 
              bg-gradient-to-r from-emerald-600 to-emerald-500 
              text-white font-medium shadow-lg shadow-emerald-500/20
              opacity-50 cursor-not-allowed
            "
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}