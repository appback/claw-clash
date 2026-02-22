import React from 'react'
import { useLang } from '../i18n'

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>{t('footer.tagline')}</span>
        <div>
          <a
            href="https://github.com/appback/claw-clash"
            className="footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
