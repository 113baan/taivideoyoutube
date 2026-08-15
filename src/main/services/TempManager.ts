/**
 * Don file rac con lai sau cac lan tai bi huy hoac that bai.
 *
 * Phan logic (isTempArtifact, planCleanup) la thuan tuy nen chay duoc trong
 * vitest; phan cham vao dia nam o cuoi file.
 *
 * CANH BAO: pause/resume cua hang doi dua vao chinh file `.part` de tai tiep.
 * Vi vay planCleanup luon nhan danh sach tien to duoc bao ve, va bat ky file
 * nao thuoc mot job con trong hang doi deu KHONG duoc dung toi.
 */

import { existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

export interface TempFile {
  name: string
  path: string
  size: number
  mtimeMs: number
}

export interface CleanupPlan {
  remove: TempFile[]
  /** Tong dung luong se giai phong. */
  bytes: number
}

/** File tai do dang cua yt-dlp. */
const PARTIAL = /\.(part|ytdl)$/i
/** Luong rieng le chua ghep, vd 'ten [id].f137.mp4'. */
const FRAGMENT = /\.f\d+\.[a-z0-9]{2,5}$/i
/** Anh bia tai kem, khong phai san pham cuoi cung. */
const THUMBNAIL = /\.(webp|jpg|jpeg|png)$/i

export function isTempArtifact(name: string): boolean {
  return PARTIAL.test(name) || FRAGMENT.test(name) || THUMBNAIL.test(name)
}

/**
 * Quyet dinh file nao duoc xoa.
 *
 * @param files       Danh sach file trong thu muc dau ra.
 * @param protectedPrefixes Tien to ten file cua cac job con trong hang doi.
 * @param now         Moc thoi gian hien tai.
 * @param minAgeMs    Chi don file cu hon nguong nay, tranh dung vao file
 *                    dang duoc ghi boi mot tien trinh khac.
 */
export function planCleanup(
  files: TempFile[],
  protectedPrefixes: string[],
  now: number,
  minAgeMs: number
): CleanupPlan {
  const remove = files.filter((file) => {
    if (!isTempArtifact(file.name)) return false
    if (now - file.mtimeMs < minAgeMs) return false
    // So khop theo tien to nen bao ve duoc moi phan mo rong cua cung mot job:
    // .part, .f137.mp4, .webp deu bat dau bang ten video.
    return !protectedPrefixes.some((prefix) => prefix && file.name.startsWith(prefix))
  })

  return { remove, bytes: remove.reduce((sum, file) => sum + file.size, 0) }
}

/* ------------------------- Phan cham vao he thong file ------------------------- */

export function scanDir(dir: string): TempFile[] {
  if (!dir || !existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .map((name) => {
        const path = join(dir, name)
        try {
          const st = statSync(path)
          if (!st.isFile()) return null
          return { name, path, size: st.size, mtimeMs: st.mtimeMs }
        } catch {
          return null
        }
      })
      .filter((x): x is TempFile => x !== null)
  } catch {
    return []
  }
}

/** Xem truoc se don gi, khong xoa. */
export function preview(dir: string, protectedPrefixes: string[], minAgeMs = 600_000): CleanupPlan {
  return planCleanup(scanDir(dir), protectedPrefixes, Date.now(), minAgeMs)
}

export interface CleanupResult {
  removed: number
  bytes: number
  failed: string[]
}

export function cleanup(
  dir: string,
  protectedPrefixes: string[],
  minAgeMs = 600_000
): CleanupResult {
  const plan = preview(dir, protectedPrefixes, minAgeMs)
  const failed: string[] = []
  let removed = 0
  let bytes = 0

  for (const file of plan.remove) {
    try {
      unlinkSync(file.path)
      removed++
      bytes += file.size
    } catch {
      // File dang bi khoa boi tien trinh khac — bo qua, lan sau don tiep.
      failed.push(file.name)
    }
  }

  return { removed, bytes, failed }
}
