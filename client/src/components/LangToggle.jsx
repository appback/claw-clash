import React from 'react'
import { useLang } from '../i18n'

export default function LangToggle() {
  const { lang, setLang } = useLang()

  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
      aria-label={lang === 'en' ? '\uD55C\uAD6D\uC5B4\uB85C \uC804\uD658' : 'Switch to English'}
      title={lang === 'en' ? 'EN' : '\uD55C'}
    >
      {lang === 'en' ? 'EN' : '\uD55C'}
    </button>
  )
}
