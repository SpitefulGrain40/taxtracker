import { useState, useCallback } from 'react'
import { verifyPin } from '../lib/auth'
import { storage } from '../lib/storage'

export function useAuth() {
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profileId = storage.getActiveProfile()

  const attemptUnlock = useCallback(async (pin: string) => {
    const hash = storage.getPinHash(profileId)
    const salt = storage.getPinSalt(profileId)
    if (!hash || !salt) {
      setError('No PIN set. Please set up your profile first.')
      return false
    }
    const valid = await verifyPin(pin, hash, salt)
    if (valid) {
      setUnlocked(true)
      setError(null)
    } else {
      setError('Incorrect PIN. Try again.')
    }
    return valid
  }, [profileId])

  const lock = useCallback(() => setUnlocked(false), [])

  return { unlocked, error, attemptUnlock, lock }
}
