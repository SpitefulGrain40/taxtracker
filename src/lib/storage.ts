const KEYS = {
  GITHUB_PAT: 'tt_github_pat',
  CLAUDE_KEY: 'tt_claude_key',
  ACTIVE_PROFILE: 'tt_active_profile',
  PIN_HASH: 'tt_pin_hash',      // per-profile: tt_pin_hash_mike
  PIN_SALT: 'tt_pin_salt',
  LAST_FX_RATE: 'tt_last_fx_',  // prefix + currency, e.g. tt_last_fx_USD
} as const

export const storage = {
  getGithubPat: () => localStorage.getItem(KEYS.GITHUB_PAT),
  setGithubPat: (pat: string) => localStorage.setItem(KEYS.GITHUB_PAT, pat),

  getClaudeKey: () => localStorage.getItem(KEYS.CLAUDE_KEY),
  setClaudeKey: (key: string) => localStorage.setItem(KEYS.CLAUDE_KEY, key),

  getActiveProfile: () => (localStorage.getItem(KEYS.ACTIVE_PROFILE) ?? 'mike') as 'mike' | 'gemma',
  setActiveProfile: (id: 'mike' | 'gemma') => localStorage.setItem(KEYS.ACTIVE_PROFILE, id),

  getPinHash: (profileId: string) => localStorage.getItem(`${KEYS.PIN_HASH}_${profileId}`),
  getPinSalt: (profileId: string) => localStorage.getItem(`${KEYS.PIN_SALT}_${profileId}`),
  setPinHash: (profileId: string, hash: string, salt: string) => {
    localStorage.setItem(`${KEYS.PIN_HASH}_${profileId}`, hash)
    localStorage.setItem(`${KEYS.PIN_SALT}_${profileId}`, salt)
  },

  getLastFxRate: (currency: string) => {
    const raw = localStorage.getItem(`${KEYS.LAST_FX_RATE}${currency}`)
    return raw ? parseFloat(raw) : null
  },
  setLastFxRate: (currency: string, rate: number) =>
    localStorage.setItem(`${KEYS.LAST_FX_RATE}${currency}`, String(rate)),

  isSetupComplete: () =>
    Boolean(localStorage.getItem(KEYS.GITHUB_PAT) && localStorage.getItem(KEYS.CLAUDE_KEY)),
}
