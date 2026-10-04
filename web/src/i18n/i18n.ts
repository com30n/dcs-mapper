import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { loadMessages, loadWords } from '../data/load'

const STORAGE_KEY = 'lang'

export async function initI18n() {
  const english = await loadMessages('en')
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['app', 'aircraft', 'ui'],
    defaultNS: 'app',
    resources: { en: { app: english } },
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    react: { bindI18nStore: 'added' },
  })
  const saved = readSaved() ?? navigator.language.slice(0, 2)
  if (saved !== 'en') await setLanguage(saved).catch(() => undefined)
}

function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export async function setLanguage(code: string) {
  if (!i18n.hasResourceBundle(code, 'app')) i18n.addResourceBundle(code, 'app', await loadMessages(code))
  await i18n.changeLanguage(code)
  document.documentElement.lang = code
  try { localStorage.setItem(STORAGE_KEY, code) } catch { return }
}

export async function loadAircraftWords(folder: string, lang: string) {
  if (lang === 'en') return
  const [words, menu] = await Promise.all([loadWords(folder, lang), loadWords('UiLayer', lang)])
  i18n.addResourceBundle(lang, 'aircraft', words, true, true)
  i18n.addResourceBundle(lang, 'ui', menu, true, true)
}

export const tr = (text: string) => i18n.t(text, { ns: 'aircraft', defaultValue: text })
export const trUi = (text: string) => i18n.t(text, { ns: 'ui', defaultValue: text })

export function useWords() {
  const { t, i18n: current } = useTranslation()
  return { t, lang: current.language, tr, trUi }
}
