import { describe, it, expect } from 'vitest'
import { encryptJSON, decryptJSON } from './encryptedExport'

describe('encryptedExport', () => {
  it('round-trips data with the correct password', async () => {
    const data = { name: 'Mike', total: 105480, sections: ['a', 'b'] }
    const blob = await encryptJSON(data, 'correct horse battery')
    const back = await decryptJSON(blob, 'correct horse battery')
    expect(back).toEqual(data)
  })

  it('produces a blob with salt, iv and ciphertext', async () => {
    const blob = await encryptJSON({ x: 1 }, 'pw')
    expect(blob.salt).toBeTruthy()
    expect(blob.iv).toBeTruthy()
    expect(blob.ciphertext).toBeTruthy()
    expect(blob.algorithm).toBe('AES-GCM')
  })

  it('fails to decrypt with the wrong password', async () => {
    const blob = await encryptJSON({ secret: 42 }, 'right')
    await expect(decryptJSON(blob, 'wrong')).rejects.toThrow()
  })
})
