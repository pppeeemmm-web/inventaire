import type { PassThrough } from 'node:stream'

/** Minimal archiver v8 ZipArchive surface (runtime ESM; @types/archiver targets v5). */
export type PemZipArchive = {
  pipe<T extends NodeJS.WritableStream>(destination: T): T
  append(source: Buffer | string, entry: { name: string }): void
  finalize(): void
  abort(): void
  on(event: 'error', listener: (err: Error) => void): void
}

type ArchiverModule = {
  ZipArchive?: new (options?: { zlib?: { level?: number } }) => PemZipArchive
  default?: ((format: string, options?: { zlib?: { level?: number } }) => PemZipArchive) & {
    create?: (format: string, options?: { zlib?: { level?: number } }) => PemZipArchive
  }
}

export async function createZipArchive(): Promise<PemZipArchive> {
  const mod = (await import('archiver')) as unknown as ArchiverModule
  if (mod.ZipArchive) {
    return new mod.ZipArchive({ zlib: { level: 0 } })
  }
  const legacy = mod.default
  if (typeof legacy === 'function') {
    return legacy('zip', { zlib: { level: 0 } })
  }
  throw new Error('Unsupported archiver module — expected ZipArchive (v8) or default (v5–7)')
}

export function finalizeZipArchive(archive: PemZipArchive, passThrough: PassThrough): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (err: Error) => reject(err)
    archive.on('error', fail)
    passThrough.once('error', fail)
    passThrough.once('end', () => resolve())
    archive.finalize()
  })
}
