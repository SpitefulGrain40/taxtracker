import { useState, useEffect, useCallback } from 'react'
import { getDataClient } from '../lib/github'
import { readTaxYear, writeTaxYear, emptyTaxYear } from '../lib/dataRepo'
import { storage } from '../lib/storage'
import { getCurrentTaxYear } from '../lib/taxYears'
import type { TaxYear, ProfileId, TaxYearKey } from '../types'

interface UseTaxYearResult {
  taxYear: TaxYear | null
  sha: string | null
  loading: boolean
  error: string | null
  saveTaxYear: (data: TaxYear) => Promise<void>
  refetch: () => void
}

export function useTaxYear(profileId: ProfileId, year?: TaxYearKey): UseTaxYearResult {
  const key = year ?? getCurrentTaxYear()
  const [taxYear, setTaxYear] = useState<TaxYear | null>(null)
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
    readTaxYear(client, profileId, key)
      .then(result => {
        setTaxYear(result?.data ?? emptyTaxYear(key))
        setSha(result?.sha ?? null)
        setError(null)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [profileId, key, tick])

  const saveTaxYear = useCallback(async (updated: TaxYear) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) throw new Error('Not configured')
    const client = getDataClient(pat, repo)
    await writeTaxYear(client, profileId, key, updated, sha ?? undefined)
    setTaxYear(updated)
    setTick(t => t + 1)
  }, [profileId, key, sha])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { taxYear, sha, loading, error, saveTaxYear, refetch }
}
