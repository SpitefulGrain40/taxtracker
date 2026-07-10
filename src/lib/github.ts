import { Octokit } from '@octokit/rest'

interface FileResult<T> {
  data: T
  sha: string
}

export class GitHubDataClient {
  private octokit: Octokit
  private owner: string
  private repo: string

  constructor(pat: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: pat })
    this.owner = owner
    this.repo = repo
  }

  async readFile<T>(path: string): Promise<FileResult<T> | null> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      })
      const file = response.data as { content: string; sha: string }
      const decoded = atob(file.content.replace(/\n/g, ''))
      return { data: JSON.parse(decoded) as T, sha: file.sha }
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 404) return null
      throw err
    }
  }

  async writeFile<T>(path: string, data: T, sha?: string): Promise<void> {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message: `chore: update ${path}`,
      content,
      ...(sha ? { sha } : {}),
    })
  }
}

// Singleton — created once from localStorage PAT
let _client: GitHubDataClient | null = null

export function getDataClient(pat: string, repoFullName: string): GitHubDataClient {
  const [owner, repo] = repoFullName.split('/')
  if (!_client) _client = new GitHubDataClient(pat, owner, repo)
  return _client
}

export function resetDataClient(): void {
  _client = null
}
