import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('')
  const timer = useRef()
  const showToast = useCallback((next) => {
    clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(''), 2200)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && <div className="toast" role="status"><CheckCircle2 size={18} />{message}</div>}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
