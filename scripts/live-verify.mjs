#!/usr/bin/env node
/**
 * TaxTracker — live credential verification.
 *
 * Reads .env.test.local (gitignored) INTERNALLY and prints only PASS/FAIL outcomes.
 * It NEVER prints the secret values themselves. Safe to run and share the output.
 *
 * Run:  node scripts/live-verify.mjs
 *
 * Checks:
 *   1. GitHub PAT can READ the private data repo (Contents scope, correct repo).
 *   2. GitHub PAT can WRITE (creates then deletes a throwaway file in data/_live-test/).
 *   3. Claude API key is valid and the model responds (tiny 1-token ping).
 *
 * Nothing here touches production data: the write test uses a unique temp path and
 * cleans up after itself.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(__dirname, '..', '.env.test.local')

function loadEnv(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.error(`\n[SETUP] ${path} not found.`)
    console.error('        Copy .env.example to .env.test.local and fill in real values.\n')
    process.exit(2)
  }
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].trim()
  }
  return env
}

const env = loadEnv(ENV_PATH)
const PAT = env.TAXTRACKER_GITHUB_PAT
const CLAUDE = env.TAXTRACKER_CLAUDE_KEY
const REPO = env.TAXTRACKER_DATA_REPO || 'SpitefulGrain40/taxtracker-data'

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

// Redact anything that looks like a token if it ever appears in an error string.
const redact = (s) =>
  String(s)
    .replace(/gh[posru]_[A-Za-z0-9_]+/g, 'ghp_***')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_***')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***')

async function checkGitHubRead() {
  if (!PAT) return record('GitHub PAT present', false, 'TAXTRACKER_GITHUB_PAT is empty')
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github+json', 'User-Agent': 'taxtracker-live-verify' },
    })
    if (r.status === 200) {
      const j = await r.json()
      record('GitHub read (repo metadata)', j.private === true, j.private ? 'repo is private (correct)' : 'WARNING: repo is public')
      return true
    }
    record('GitHub read (repo metadata)', false, `HTTP ${r.status} — check PAT scope/repo`)
    return false
  } catch (e) {
    record('GitHub read (repo metadata)', false, redact(e.message))
    return false
  }
}

async function checkGitHubWrite() {
  if (!PAT) return
  const path = `data/_live-test/ping.txt`
  const content = Buffer.from(`live-verify ${new Date().toISOString()}`).toString('base64')
  try {
    // Does it already exist? (get sha for clean overwrite/delete)
    let sha
    const head = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'taxtracker-live-verify' },
    })
    if (head.status === 200) sha = (await head.json()).sha

    const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'taxtracker-live-verify', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'live-verify write test', content, ...(sha ? { sha } : {}) }),
    })
    if (put.status !== 200 && put.status !== 201) {
      record('GitHub write (create file)', false, `HTTP ${put.status} — PAT likely lacks Contents:Write`)
      return
    }
    const putJson = await put.json()
    record('GitHub write (create file)', true, 'wrote data/_live-test/ping.txt')

    // Clean up: delete the throwaway file.
    const del = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'taxtracker-live-verify', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'live-verify cleanup', sha: putJson.content.sha }),
    })
    record('GitHub write (cleanup delete)', del.status === 200, del.status === 200 ? 'removed test file' : `HTTP ${del.status}`)
  } catch (e) {
    record('GitHub write', false, redact(e.message))
  }
}

async function checkClaude() {
  if (!CLAUDE) return record('Claude key present', false, 'TAXTRACKER_CLAUDE_KEY is empty')
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }),
    })
    if (r.status === 200) {
      const j = await r.json()
      const text = (j.content?.[0]?.text || '').toLowerCase()
      record('Claude API (message ping)', text.includes('ok'), `model responded (${j.model || 'unknown model'})`)
      return
    }
    const body = await r.text()
    record('Claude API (message ping)', false, `HTTP ${r.status} — ${redact(body).slice(0, 120)}`)
  } catch (e) {
    record('Claude API (message ping)', false, redact(e.message))
  }
}

console.log('\nTaxTracker live credential verification')
console.log('=======================================')
console.log(`Repo: ${REPO}`)
console.log('(secret values are never printed)\n')

await checkGitHubRead()
await checkGitHubWrite()
await checkClaude()

const passed = results.filter((r) => r.ok).length
console.log('\n=======================================')
console.log(`${passed}/${results.length} checks passed`)
process.exit(passed === results.length ? 0 : 1)
