const COOKIE_NAME = 'cc_credits'
const DEFAULT_CREDITS = 5
const MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function setCookie(name, value, maxAge) {
  document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`
}

export function getCredits() {
  const val = getCookie(COOKIE_NAME)
  return val != null ? parseInt(val, 10) : DEFAULT_CREDITS
}

export function setCredits(n) {
  setCookie(COOKIE_NAME, Math.max(0, n), MAX_AGE)
}

export function useCredit() {
  setCredits(getCredits() - 1)
}

export function addCredits(n) {
  setCredits(getCredits() + n)
}
