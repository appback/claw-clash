import { createContext, useContext, useState, useCallback } from 'react'
import en from './en.json'
import ko from './ko.json'

const messages = { en, ko }

const LangContext = createContext()

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === 'undefined') return 'en'
    return localStorage.getItem('lang') || 'en'
  })

  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])

  const t = useCallback((key, params) => {
    let val = get(messages[lang], key) ?? get(messages.en, key) ?? key
    if (params && typeof val === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replaceAll(`{${k}}`, v)
      })
    }
    return val
  }, [lang])

  return (
    <LangContext.Provider value={{ t, lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
