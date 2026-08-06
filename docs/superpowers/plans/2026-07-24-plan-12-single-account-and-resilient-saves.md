# Plan 12: Single-account model + resilient saves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two bugs that blocked end-to-end testing — onboarding saves failing with `"sha" wasn't supplied` (#10), and the profile-switch lockout (#11) — by making saves self-heal and collapsing to one account per install. Verify the downstream reactivity FAILs (#12) clear.

**Architecture:** `writeFile` retries once with a freshly-read sha when GitHub rejects a stale/absent sha. The app is already effectively single-account (`SetupScreen` hardcodes the `'mike'` namespace and creates its PIN there); this plan removes the "Switch profile" feature that strands users, and makes `getActiveProfile()` return the single fixed account — which also auto-recovers any browser currently stuck on the switched-to profile.

**Tech Stack:** React 18, TypeScript strict, Vitest. Touches `src/lib/github.ts`, `src/lib/storage.ts`, `src/AppRouter.tsx`, `src/components/layout/{AppShell,DesktopNav,MoreDrawer}.tsx`, and their tests.

## Global Constraints

- Work on branch `dev`. Never commit to `main`. Commit with **explicit file paths** — never `git add -A`/`.`/`-am`.
- No emojis (Lucide only); Tailwind tokens only; strict TS (`noUnusedLocals`/`noUnusedParameters`).
- Secrets stay in localStorage only. Run `npm run test` (currently **214**) and `npm run build` before each commit.
- **Data path stays `data/mike/…`** — do not migrate/rename it. It's now just the single fixed per-install namespace; each person has their own private repo, so the folder name is cosmetic and a rename would risk existing data. (A future cosmetic rename can be its own issue.)

---

## Task 1: Self-healing `writeFile` (fix #10)

**Files:**
- Modify: `src/lib/github.ts`
- Modify: `src/lib/github.test.ts`

**Interfaces:**
- `GitHubDataClient.writeFile` keeps its signature `writeFile<T>(path, data, sha?): Promise<string | undefined>` (returns the new sha, from Plan 11) but now retries on a stale/absent-sha rejection.

Root cause: GitHub's create-or-update endpoint rejects with 409/422 when the file already exists and the supplied `sha` is absent or stale (`"sha" wasn't supplied` / `does not match`). During onboarding the data repo already holds the files, and a flaky/raced initial read leaves the app with no sha, so the write is sent as a bare create and rejected.

- [ ] **Step 1: Write the failing test** — add to `src/lib/github.test.ts` (it already mocks octokit). A test where the first `createOrUpdateFileContents` rejects with `{ status: 422 }`, `getContent` then resolves a file with a `sha`, and the second `createOrUpdateFileContents` resolves — assert `writeFile` resolves (retried) and that `createOrUpdateFileContents` was called twice, the second time with the re-read `sha`. Match the existing mock style in that file (read it first for how octokit is mocked).

- [ ] **Step 2: Run it, confirm it fails** — `npx vitest run src/lib/github.test.ts` → the single-attempt code throws instead of retrying.

- [ ] **Step 3: Implement the retry** — in `src/lib/github.ts`, wrap the write:

```ts
async writeFile<T>(path: string, data: T, sha?: string): Promise<string | undefined> {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
  const base = { owner: this.owner, repo: this.repo, path, message: `chore: update ${path}` }
  try {
    const res = await this.octokit.repos.createOrUpdateFileContents({ ...base, content, ...(sha ? { sha } : {}) })
    return res.data?.content?.sha
  } catch (err: unknown) {
    // File already exists / stale sha → re-read the current sha and retry once.
    const status = (err as { status?: number }).status
    if (status === 409 || status === 422) {
      const existing = await this.readFile<unknown>(path)
      if (existing?.sha) {
        const res = await this.octokit.repos.createOrUpdateFileContents({ ...base, content, sha: existing.sha })
        return res.data?.content?.sha
      }
    }
    throw err
  }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/github.test.ts` passes; `npm run test` (215) and `npm run build` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/github.test.ts
git commit -m "fix: writeFile self-heals on a stale/absent sha (re-read + retry) (#10)"
```

---

## Task 2: Collapse to one account — remove profile switching (fix #11)

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/AppRouter.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/DesktopNav.tsx`
- Modify: `src/components/layout/MoreDrawer.tsx`
- Modify: `src/components/layout/MoreDrawer.test.tsx`

Read every file fully first. The active profile is already `'mike'` everywhere (SetupScreen hardcodes it); this task removes the switch that can strand a user, and makes recovery automatic.

Requirements:
1. **`storage.getActiveProfile()` returns the single fixed account.** Change it to always return `'mike'` (ignore any stored `tt_active_profile` value). This auto-recovers any browser currently stuck on `gemma`: on next load the app reads the `'mike'` PIN/onboarding/data again and unlocks normally. Remove `setActiveProfile` (or leave it unused-but-remove its only caller — see below; do not leave an unused export that trips `noUnusedLocals` in consumers, but an unused public method on the `storage` object is fine — prefer removing it for cleanliness).
2. **`AppRouter.tsx`:** delete `handleProfileSwitch` and stop passing `onProfileSwitch` to `AppShell`.
3. **`AppShell.tsx`:** remove the `onProfileSwitch` prop and its use; stop passing `onSwitchProfile` to `MoreDrawer` and `onProfileClick` to `DesktopNav`. `profileName` may stay for the avatar display.
4. **`DesktopNav.tsx`:** the profile button no longer switches. Make the avatar a **link to `/account`** (a `NavLink`/button that navigates to `/account`) instead of an `onProfileClick` switch — a useful destination that replaces the dead action. Remove the `onProfileClick` prop.
5. **`MoreDrawer.tsx`:** remove the **"Switch profile"** entry and the `onSwitchProfile` prop entirely. The drawer now lists: Tax Return, Account & profile, Price settings, Submit feedback, Lock. Keep `profileName` only if still used; otherwise remove it too (mind `noUnusedParameters`).
6. **`MoreDrawer.test.tsx`:** update — remove the "Switch profile" assertions and the `onSwitchProfile` prop from the test props; the ordered-list assertion must now expect the 5 remaining entries (Tax Return, Account & profile, Price settings, Submit feedback, Lock). Keep every other assertion.

- [ ] **Step 1:** Make the six edits above.
- [ ] **Step 2:** `npm run build` (clean — this is how you catch a dropped prop) and `npm run test` (the updated MoreDrawer test + all others pass).
- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts src/AppRouter.tsx src/components/layout/AppShell.tsx src/components/layout/DesktopNav.tsx src/components/layout/MoreDrawer.tsx src/components/layout/MoreDrawer.test.tsx
git commit -m "feat: one account per install — remove profile switching, auto-recover stuck sessions (#11)"
```

---

## Task 3: Deploy, verify recovery, and re-check reactivity (#12)

**Files:** none (deploy + verification).

- [ ] **Step 1:** `git status -s` clean, then `git push origin dev`.
- [ ] **Step 2:** Confirm the staging deploy is green — `gh run watch $(gh run list --branch dev --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 3:** Comment on the issues:
  - `#10`: fixed — writeFile now re-reads the sha and retries, so onboarding saves survive an existing file / flaky read.
  - `#11`: fixed — profile switching removed; `getActiveProfile()` returns the single account, which also auto-recovers any session stuck on the switched-to profile.
  - `#12`: base-salary / payslip-correction edits should now reflect once onboarding persists (the sha fix). Ask the user to re-verify on device; if either still doesn't update after a successful onboarding, reopen with a note and investigate `useProfile`/`useTaxYear` refetch-on-navigation.

Leave #10/#11/#12 open until the user confirms on device.

---

## Self-review notes

- **#10:** Task 1 — self-healing write with a re-read + single retry on 409/422; unit-tested.
- **#11:** Task 2 — switch removed at every layer (storage/router/shell/nav/drawer + test); `getActiveProfile()` fixed to one account auto-recovers stuck browsers (no clear-site-data needed).
- **#12:** Task 3 — verification; the FAILs were almost certainly downstream of the onboarding save failing partway (no payslip/taxYear persisted). Re-check after Task 1; only dig into refetch behaviour if it reproduces on a clean onboarding.
- **Deliberately deferred:** the `data/mike/` folder name is now the single per-install namespace — kept as-is to avoid migration; a cosmetic rename to a neutral namespace can be a separate issue. The projection UX requests (#13–#16) are Plan 13.
- **Data safety:** no data-path or data-shape change; existing repos keep working. Removing switching only drops a localStorage key's effect, not any data.
