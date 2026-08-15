import { app, shell } from 'electron'
import { execFile, spawn } from 'child_process'
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync
} from 'fs'
import { get as httpsGet } from 'https'
import { dirname, join } from 'path'
import type { BinaryInfo, BinaryProgress, BinaryStatus } from '../shared/types'
import { getSettings } from './settings'

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
/** Ban build tinh chinh thuc cua BtbN, chua ffmpeg.exe da lien ket san. */
const FFMPEG_ZIP_URL =
  'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip'

/** Thu muc chua binary tai ve khi chay (ghi duoc ca khi app da cai dat). */
export function userBinDir(): string {
  const dir = join(app.getPath('userData'), 'bin')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Thu muc resources duoc dong goi kem app (chi doc). */
function bundledBinDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bin')
    : join(app.getAppPath(), 'resources', 'bin')
}

function runVersion(exe: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(exe, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null)
      resolve(stdout.toString().trim().split('\n')[0] ?? null)
    })
  })
}

/** Tim exe trong PATH he thong. */
function whichExe(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where', [name], { timeout: 8000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null)
      const first = stdout.toString().trim().split(/\r?\n/)[0]
      resolve(first && existsSync(first) ? first : null)
    })
  })
}

export function ytdlpTargetPath(): string {
  return join(userBinDir(), 'yt-dlp.exe')
}

export function ffmpegTargetPath(): string {
  return join(userBinDir(), 'ffmpeg.exe')
}

/**
 * Thu tu uu tien: binary dong goi kem app -> binary da tai ve -> PATH he thong.
 * Nho vay ban cai dat dung binary kem theo, con ban dev thi tu tai.
 */
export async function resolveYtdlp(): Promise<string | null> {
  const bundled = join(bundledBinDir(), 'yt-dlp.exe')
  if (existsSync(bundled)) return bundled
  if (existsSync(ytdlpTargetPath())) return ytdlpTargetPath()
  return whichExe('yt-dlp.exe')
}

export async function resolveFfmpeg(): Promise<string | null> {
  const custom = getSettings().ffmpegPath
  if (custom && existsSync(custom)) return custom
  const bundled = join(bundledBinDir(), 'ffmpeg.exe')
  if (existsSync(bundled)) return bundled
  if (existsSync(ffmpegTargetPath())) return ffmpegTargetPath()
  return whichExe('ffmpeg.exe')
}

/**
 * ffprobe thuong nam canh ffmpeg. Tim canh ffmpeg truoc roi moi den PATH,
 * de khong lay nham ban ffprobe cua mot bo cai khac phien ban.
 */
export async function resolveFfprobe(known?: string | null): Promise<string | null> {
  // Nhan san duong dan ffmpeg de khong phai do tim lai — do tim lai khien ba
  // buoc nhan dien engine chay noi tiep, lam man hinh dau tien cham han len.
  const ffmpeg = known !== undefined ? known : await resolveFfmpeg()
  if (ffmpeg) {
    const sibling = join(dirname(ffmpeg), 'ffprobe.exe')
    if (existsSync(sibling)) return sibling
  }
  const bundled = join(bundledBinDir(), 'ffprobe.exe')
  if (existsSync(bundled)) return bundled
  const downloaded = join(userBinDir(), 'ffprobe.exe')
  if (existsSync(downloaded)) return downloaded
  return whichExe('ffprobe.exe')
}

/** Rut gon chuoi phien ban dai cua cac ban build FFmpeg. */
function shortFfVersion(raw: string | null): string | null {
  if (!raw) return null
  return (
    raw.match(/version n?(\d+\.\d+(?:\.\d+)?)/)?.[1] ??
    raw.match(/version (\S{1,14})/)?.[1] ??
    raw.slice(0, 14)
  )
}

export async function getBinaryStatus(): Promise<BinaryStatus> {
  const [ytdlp, ffmpeg] = await Promise.all([resolveYtdlp(), resolveFfmpeg()])
  const ffprobe = await resolveFfprobe(ffmpeg)
  const [ytVer, ffVer, fpVer] = await Promise.all([
    ytdlp ? runVersion(ytdlp, ['--version']) : Promise.resolve(null),
    ffmpeg ? runVersion(ffmpeg, ['-version']) : Promise.resolve(null),
    ffprobe ? runVersion(ffprobe, ['-version']) : Promise.resolve(null)
  ])
  const bundledDir = bundledBinDir()
  const info = (path: string | null, version: string | null): BinaryInfo => ({
    path,
    version,
    ready: Boolean(path && version),
    bundled: Boolean(path?.startsWith(bundledDir))
  })

  return {
    ytdlp: info(ytdlp, ytVer),
    // Dong dau co dang "ffmpeg version 8.1-full_build-www.gyan.dev ..." —
    // hau to cua nha dung ban qua dai se lam vo layout sidebar.
    ffmpeg: info(ffmpeg, shortFfVersion(ffVer)),
    ffprobe: info(ffprobe, shortFfVersion(fpVer))
  }
}

/**
 * Tai 1 file qua HTTPS, ghi ra .part roi doi ten khi xong.
 * Tranh de lai binary hong neu mat mang giua chung.
 */
function downloadTo(
  url: string,
  target: string,
  label: string,
  onProgress: (p: BinaryProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = `${target}.part`
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp)
      } catch {
        /* bo qua */
      }
    }

    const request = (currentUrl: string, redirects = 0): void => {
      if (redirects > 5) {
        reject(new Error('Chuyển hướng quá nhiều lần khi tải'))
        return
      }
      httpsGet(currentUrl, { headers: { 'User-Agent': 'VidGrab' } }, (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          request(res.headers.location, redirects + 1)
          return
        }
        if (status !== 200) {
          res.resume()
          reject(new Error(`Máy chủ trả về HTTP ${status}`))
          return
        }

        const total = Number(res.headers['content-length'] ?? 0)
        let received = 0
        let lastTick = 0
        const file = createWriteStream(tmp)

        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          // Gioi han nhip cap nhat, tranh spam IPC voi file lon.
          const now = Date.now()
          if (now - lastTick < 200) return
          lastTick = now
          onProgress({
            stage: 'downloading',
            percent: total ? Math.round((received / total) * 100) : 0,
            message: `Đang tải ${label}... ${(received / 1048576).toFixed(1)} MB${
              total ? ` / ${(total / 1048576).toFixed(0)} MB` : ''
            }`
          })
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            try {
              if (existsSync(target)) unlinkSync(target)
              renameSync(tmp, target)
              resolve(target)
            } catch (err) {
              reject(err as Error)
            }
          })
        })
        file.on('error', (err) => {
          try {
            unlinkSync(tmp)
          } catch {
            /* bo qua */
          }
          reject(err)
        })
      }).on('error', reject)
    }

    onProgress({ stage: 'downloading', percent: 0, message: `Đang kết nối để tải ${label}...` })
    request(url)
  })
}

export async function downloadYtdlp(onProgress: (p: BinaryProgress) => void): Promise<string> {
  const path = await downloadTo(YTDLP_URL, ytdlpTargetPath(), 'yt-dlp.exe', onProgress)
  onProgress({ stage: 'done', percent: 100, message: 'Đã cài đặt yt-dlp' })
  return path
}

/**
 * Cap nhat yt-dlp. Neu binary nam trong thu muc userData thi dung `-U` (tu cap nhat).
 * Neu khong (dang dung ban trong PATH hoac ban dong goi kem) thi tai ban moi ve userData.
 */
export async function updateYtdlp(onProgress: (p: BinaryProgress) => void): Promise<string> {
  const current = await resolveYtdlp()
  if (current && current === ytdlpTargetPath()) {
    return new Promise((resolve, reject) => {
      onProgress({ stage: 'downloading', percent: 50, message: 'Đang chạy yt-dlp -U...' })
      execFile(current, ['-U'], { timeout: 180000, windowsHide: true }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr?.toString() || err.message))
        onProgress({ stage: 'done', percent: 100, message: stdout.toString().trim().slice(-200) })
        resolve(current)
      })
    })
  }
  return downloadYtdlp(onProgress)
}

/** Giai nen bang PowerShell — Node khong co san bo giai nen zip. */
function expandArchive(zip: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        // Duong dan di qua tham so -Command nen phai boc trong dau nhay don
        // va nhan doi dau nhay don co san, tranh thoat khoi chuoi.
        `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(
          /'/g,
          "''"
        )}' -Force`
      ],
      { windowsHide: true }
    )
    let err = ''
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(err.trim() || `Giải nén thất bại (mã ${code})`))
    )
  })
}

/** Tim ffmpeg.exe trong cay thu muc vua giai nen. */
function findExe(dir: string, name: string, depth = 0): string | null {
  if (depth > 4) return null
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) {
      const found = findExe(full, name, depth + 1)
      if (found) return found
    } else if (entry.toLowerCase() === name) {
      return full
    }
  }
  return null
}

/**
 * Tai va cai FFmpeg vao thu muc userData. Nho vay ban cai dat khong can
 * dong goi kem file ~120 MB, ma may sach van dung duoc day du tinh nang.
 */
export async function downloadFfmpeg(onProgress: (p: BinaryProgress) => void): Promise<string> {
  const work = join(app.getPath('temp'), `vidgrab-ffmpeg-${Date.now()}`)
  mkdirSync(work, { recursive: true })
  const zip = join(work, 'ffmpeg.zip')

  try {
    await downloadTo(FFMPEG_ZIP_URL, zip, 'FFmpeg', onProgress)
    onProgress({ stage: 'downloading', percent: 96, message: 'Đang giải nén FFmpeg...' })
    await expandArchive(zip, work)

    const found = findExe(work, 'ffmpeg.exe')
    if (!found) throw new Error('Không tìm thấy ffmpeg.exe trong gói vừa tải')

    copyFileSync(found, ffmpegTargetPath())
    // ffprobe di kem giup yt-dlp doc chinh xac thong tin luong media.
    const probe = findExe(work, 'ffprobe.exe')
    if (probe) copyFileSync(probe, join(userBinDir(), 'ffprobe.exe'))

    onProgress({ stage: 'done', percent: 100, message: 'Đã cài đặt FFmpeg' })
    return ffmpegTargetPath()
  } finally {
    try {
      rmSync(work, { recursive: true, force: true })
    } catch {
      /* thu muc tam se duoc Windows don sau */
    }
  }
}

export function openEngineFolder(): void {
  void shell.openPath(userBinDir())
}

/** Xoa binary da tai ve, buoc app quay lai dung ban dong goi kem hoac PATH. */
export function resetEngine(): void {
  for (const name of ['yt-dlp.exe', 'ffmpeg.exe', 'ffprobe.exe']) {
    const path = join(userBinDir(), name)
    try {
      if (existsSync(path)) unlinkSync(path)
    } catch {
      /* file dang duoc dung, bo qua */
    }
  }
}
