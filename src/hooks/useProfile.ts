import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readProfile, writeProfile } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import { isDevSeedActive, seedProfile } from '../lib/devSeed'
import type { Profile, ProfileId } from '../types'

interface UseProfileResult {
  profile: Profile | null
  sha: string | null
  loading: boolean
  error: string | null
  saveProfile: (profile: Profile) => Promise<void>
  refetch: () => void
}

export function useProfile(profileId: ProfileId): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (isDevSeedActive()) {
      setProfile(seedProfile(profileId)); setSha('dev'); setError(null); setLoading(false)
      return
    }
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLoading(false); return }

    const client = getDataClient(pat, repo)
    setLoading(true)
    readProfile(client, profileId)
      .then(result => {
        setProfile(result?.data ?? null)
        setSha(result?.sha ?? null)
        setError(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, tick])

  const saveProfile = useCallback(async (updated: Profile) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    await writeProfile(client, profileId, updated, sha ?? undefined)
    setProfile(updated)
    setTick(t => t + 1)
  }, [profileId, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { profile, sha, loading, error, saveProfile, refetch }
}
