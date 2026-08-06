const KEYS = {
  GITHUB_PAT: 'tt_github_pat',
  CLAUDE_KEY: 'tt_claude_key',
  ACTIVE_PROFILE: 'tt_active_profile',
  PIN_HASH: 'tt_pin_hash',      // per-profile: tt_pin_hash_mike
  PIN_SALT: 'tt_pin_salt',
  LAST_FX_RATE: 'tt_last_fx_',  // prefix + currency, e.g. tt_last_fx_USD
  PRICE_PROXY_URL: 'tt_price_proxy_url',
  PRICE_SYMBOL: 'tt_price_symbol_',  // prefix + profileId, e.g. tt_price_symbol_mike
} as const

export const storage = {
  getGithubPat: () => localStorage.getItem(KEYS.GITHUB_PAT),
  setGithubPat: (pat: string) => localStorage.setItem(KEYS.GITHUB_PAT, pat),

  getClaudeKey: () => localStorage.getItem(KEYS.CLAUDE_KEY),
  setClaudeKey: (key: string) => localStorage.setItem(KEYS.CLAUDE_KEY, key),

  // Single fixed account per install — always 'mike'. Ignoring any stored
  // value auto-recovers a browser previously stuck on 'gemma' (fix #11).
  getActiveProfile: (): 'mike' | 'gemma' => 'mike',

  setPinHash: (profileId: string, hash: string, salt: string) => {
    localStorage.setItem(`tt_pin_${profileId}`, JSON.stringify({ hash, salt }))
  },
  getPinHash: (profileId: string) => {
    const raw = localStorage.getItem(`tt_pin_${profileId}`)
    if (!raw) return null
    try { return (JSON.parse(raw) as { hash: string; salt: string }).hash } catch { return null }
  },
  getPinSalt: (profileId: string) => {
    const raw = localStorage.getItem(`tt_pin_${profileId}`)
    if (!raw) return null
    try { return (JSON.parse(raw) as { hash: string; salt: string }).salt } catch { return null }
  },

  getLastFxRate: (currency: string) => {
    const raw = localStorage.getItem(`${KEYS.LAST_FX_RATE}${currency}`)
    if (!raw) return null
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : null
  },
  setLastFxRate: (currency: string, rate: number) => {
    if (!Number.isFinite(rate)) return
    localStorage.setItem(`${KEYS.LAST_FX_RATE}${currency}`, String(rate))
  },

  getPriceProxyUrl: () => localStorage.getItem(KEYS.PRICE_PROXY_URL),
  setPriceProxyUrl: (url: string) => localStorage.setItem(KEYS.PRICE_PROXY_URL, url),
  getPriceSymbol: (profileId: string) => localStorage.getItem(`${KEYS.PRICE_SYMBOL}${profileId}`),
  setPriceSymbol: (profileId: string, symbol: string) => localStorage.setItem(`${KEYS.PRICE_SYMBOL}${profileId}`, symbol),

  isSetupComplete: () =>
    Boolean(localStorage.getItem(KEYS.GITHUB_PAT) && localStorage.getItem(KEYS.CLAUDE_KEY)),

  isOnboardingComplete: (profileId: string) =>
    Boolean(localStorage.getItem(`tt_onboarding_${profileId}`)),
  setOnboardingComplete: (profileId: string) =>
    localStorage.setItem(`tt_onboarding_${profileId}`, '1'),
}
