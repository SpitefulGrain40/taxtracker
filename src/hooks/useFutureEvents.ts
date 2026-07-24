import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readFutureEvents, writeFutureEvents } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import type { FutureIncomeEvent, ProfileId } from '../types'

interface UseFutureEventsResult {
  events: FutureIncomeEvent[]
  sha: string | null
  loading: boolean
  error: string | null
  saveEvents: (events: FutureIncomeEvent[]) => Promise<void>
  refetch: () => void
}

export function useFutureEvents(profileId: ProfileId): UseFutureEventsResult {
  const [events, setEvents] = useState<FutureIncomeEvent[]>([])
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLoading(false); return }
    const client = getDataClient(pat, repo)
    setLoading(true)
    readFutureEvents(client, profileId)
      .then(result => { setEvents(result?.data ?? []); setSha(result?.sha ?? null); setError(null) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, tick])

  const saveEvents = useCallback(async (updated: FutureIncomeEvent[]) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    const newSha = await writeFutureEvents(client, profileId, updated, sha ?? undefined)
    setEvents(updated)
    setSha(newSha ?? null)
  }, [profileId, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { events, sha, loading, error, saveEvents, refetch }
}
