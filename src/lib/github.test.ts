import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubDataClient } from './github'

const mockOctokit = {
  repos: {
    getContent: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
  },
}

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () { return mockOctokit }),
}))

describe('GitHubDataClient.readFile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('decodes base64 content and parses JSON', async () => {
    const data = { hello: 'world' }
    mockOctokit.repos.getContent.mockResolvedValue({
      data: {
        content: btoa(JSON.stringify(data)) + '\n',
        sha: 'abc123',
      },
    })
    const client = new GitHubDataClient('token', 'owner', 'repo')
    const result = await client.readFile('data/mike/profile.json')
    expect(result!.data).toEqual(data)
    expect(result!.sha).toBe('abc123')
  })

  it('returns null when file does not exist', async () => {
    mockOctokit.repos.getContent.mockRejectedValue({ status: 404 })
    const client = new GitHubDataClient('token', 'owner', 'repo')
    const result = await client.readFile('data/mike/missing.json')
    expect(result).toBeNull()
  })
})

describe('GitHubDataClient.writeFile', () => {
  it('encodes JSON to base64 and calls createOrUpdateFileContents', async () => {
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({})
    const client = new GitHubDataClient('token', 'owner', 'repo')
    await client.writeFile('data/mike/profile.json', { name: 'Mike' }, 'abc123')
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'data/mike/profile.json',
        message: 'chore: update data/mike/profile.json',
        sha: 'abc123',
      })
    )
  })
})
