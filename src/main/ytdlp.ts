import { ChildProcess, spawn } from 'child_process'
import { existsSync } from 'fs'
import type {
  FormatRow,
  FriendlyError,
  JobOptions,
  MediaInfo,
  ProbeResult
} from '../shared/types'
import { resolveFfmpeg, resolveYtdlp } from './binaries'
import { classifyError, simpleError } from './errors'
import { safeTemplate } from './services/FilenameService'
import { formatSelector } from './services/FormatService'
import { ensureOutputDir, getSettings } from './settings'

/** Tien to danh dau dong tien trinh, de tach khoi log thuong cua yt-dlp. */
const PROGRESS_TAG = '@@VG@@'

/**
 * Chan argument injection: neu chuoi bat dau bang '-', yt-dlp se hieu no la
 * tuy chon dong lenh chu khong phai URL. Chi cho phep http/https.
 */
export function assertHttpUrl(url: string): string {
  const trimmed = String(url ?? '').trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(`URL không hợp lệ: ${trimmed.slice(0, 120)}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Chỉ hỗ trợ link http/https, không hỗ trợ "${parsed.protocol}"`)
  }
  return parsed.toString()
}

/** Cac tham so dung chung cho moi lan goi yt-dlp. */
function baseArgs(): string[] {
  const s = getSettings()
  const args = [
    '--ignore-config', // bo qua config toan cuc cua may, tranh xung dot
    '--no-warnings',
    '--no-color'
  ]
  // File cookie duoc uu tien hon trinh duyet: doc tu file khong dinh khoa file
  // cua trinh duyet dang chay, cung khong dinh ma hoa app-bound cua Chrome 127+.
  if (s.cookieFile && existsSync(s.cookieFile)) args.push('--cookies', s.cookieFile)
  else if (s.cookiesFromBrowser) args.push('--cookies-from-browser', s.cookiesFromBrowser)
  if (s.proxy) args.push('--proxy', s.proxy)
  return args
}

function toFormatRow(f: Record<string, unknown>): FormatRow {
  const vcodec = (f.vcodec as string | undefined) ?? null
  const acodec = (f.acodec as string | undefined) ?? null
  const hasVideo = Boolean(vcodec && vcodec !== 'none')
  const hasAudio = Boolean(acodec && acodec !== 'none')
  const exact = f.filesize as number | undefined
  const approx = f.filesize_approx as number | undefined
  const height = (f.height as number | undefined) ?? null
  const width = (f.width as number | undefined) ?? null
  return {
    formatId: String(f.format_id ?? ''),
    ext: String(f.ext ?? ''),
    resolution:
      (f.resolution as string | undefined) ??
      (height ? `${width ?? '?'}x${height}` : hasAudio && !hasVideo ? 'audio' : '?'),
    width,
    height,
    fps: (f.fps as number | undefined) ?? null,
    vcodec: hasVideo ? vcodec : null,
    acodec: hasAudio ? acodec : null,
    filesize: exact ?? approx ?? null,
    filesizeApprox: exact === undefined && approx !== undefined,
    tbr: (f.tbr as number | undefined) ?? null,
    note: String(f.format_note ?? ''),
    protocol: String(f.protocol ?? ''),
    dynamicRange: (f.dynamic_range as string | undefined) ?? null,
    hasVideo,
    hasAudio
  }
}

function toMediaInfo(
  raw: Record<string, any>,
  sourceUrl: string,
  playlistTitle: string | null
): MediaInfo {
  const formats: FormatRow[] = Array.isArray(raw.formats)
    ? raw.formats
        .filter((f: any) => f && f.format_id && f.format_id !== 'source')
        .map(toFormatRow)
        // yt-dlp tra ve tu kem den tot; dao lai de format tot nhat nam tren dau bang.
        .reverse()
    : []
  return {
    sourceUrl,
    url: raw.webpage_url ?? raw.url ?? sourceUrl,
    id: String(raw.id ?? ''),
    title: raw.title ?? raw.id ?? '(không có tiêu đề)',
    uploader: raw.uploader ?? raw.channel ?? raw.uploader_id ?? null,
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    thumbnail: raw.thumbnail ?? null,
    extractor: raw.extractor_key ?? raw.extractor ?? '',
    uploadDate: raw.upload_date ?? null,
    viewCount: typeof raw.view_count === 'number' ? raw.view_count : null,
    formats,
    subtitles: raw.subtitles ? Object.keys(raw.subtitles) : [],
    autoSubtitles: raw.automatic_captions ? Object.keys(raw.automatic_captions).slice(0, 40) : [],
    isPlaylistEntry: formats.length === 0,
    playlistTitle
  }
}

function runJson(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    void resolveYtdlp().then((exe) => {
      if (!exe) {
        reject(new Error('YTDLP_MISSING'))
        return
      }
      const child = spawn(exe, args, { windowsHide: true })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => (out += d.toString()))
      child.stderr.on('data', (d) => (err += d.toString()))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0 && out.trim()) resolve(out)
        else reject(new Error(err.trim() || `yt-dlp thoát với mã ${code}`))
      })
    })
  })
}

function probeFailure(message: string): FriendlyError {
  if (message === 'YTDLP_MISSING') {
    return simpleError(
      'Chưa cài engine yt-dlp',
      'VidGrab cần yt-dlp để đọc thông tin video.',
      'Mở Cài đặt > Engine và bấm Cài đặt engine.'
    )
  }
  return classifyError(message)
}

/**
 * Phan tich 1 URL. Playlist duoc lay o che do phang (nhanh, chua co format),
 * video don le duoc lay day du danh sach format.
 */
export async function probe(sourceUrl: string): Promise<ProbeResult> {
  let url: string
  try {
    url = assertHttpUrl(sourceUrl)
  } catch (e) {
    return {
      sourceUrl,
      ok: false,
      playlistCount: 0,
      error: simpleError(
        'Link không hợp lệ',
        (e as Error).message,
        'Link phải bắt đầu bằng http:// hoặc https://'
      ),
      items: []
    }
  }

  try {
    const out = await runJson([...baseArgs(), '-J', '--flat-playlist', '--', url])
    const raw = JSON.parse(out)
    if (raw._type === 'playlist' && Array.isArray(raw.entries)) {
      const items = raw.entries
        .filter(Boolean)
        .map((e: any) => toMediaInfo(e, e.url ?? e.webpage_url ?? url, raw.title ?? null))
      return { sourceUrl, ok: true, error: null, items, playlistCount: items.length }
    }
    return {
      sourceUrl,
      ok: true,
      error: null,
      items: [toMediaInfo(raw, url, null)],
      playlistCount: 0
    }
  } catch (e) {
    return { sourceUrl, ok: false, error: probeFailure((e as Error).message), items: [], playlistCount: 0 }
  }
}

/** Lay danh sach format day du cho 1 muc playlist (goi khi mo phan chon chat luong). */
export async function probeSingle(url: string): Promise<MediaInfo | null> {
  try {
    const safe = assertHttpUrl(url)
    const out = await runJson([...baseArgs(), '-J', '--no-playlist', '--', safe])
    return toMediaInfo(JSON.parse(out), safe, null)
  } catch {
    return null
  }
}

export interface DownloadHandle {
  child: ChildProcess
  promise: Promise<string | null>
}

export interface DownloadEvents {
  onProgress: (p: {
    percent: number
    downloadedBytes: number
    totalBytes: number | null
    speed: number | null
    eta: number | null
  }) => void
  onStage: (stage: string) => void
  onFile: (path: string) => void
}

function isAudioPreset(opts: JobOptions): boolean {
  return opts.preset === 'audio' || opts.preset === 'audio-mp3' || opts.preset === 'audio-m4a'
}

function isSidecarPreset(opts: JobOptions): boolean {
  return opts.preset === 'subtitles' || opts.preset === 'thumbnail'
}

/**
 * Bat dau tai 1 video. Tra ve ca child process (de huy/tam dung) va promise ket qua.
 * Promise resolve voi duong dan file cuoi cung (neu bat duoc), reject khi loi.
 */
export async function startDownload(
  url: string,
  opts: JobOptions,
  ev: DownloadEvents
): Promise<DownloadHandle> {
  const s = getSettings()
  const safeUrl = assertHttpUrl(url)
  const exe = await resolveYtdlp()
  if (!exe) throw new Error('YTDLP_MISSING')
  const ffmpeg = await resolveFfmpeg()
  const outDir = ensureOutputDir(opts.outputDir)
  const audioOnly = isAudioPreset(opts)
  const sidecar = isSidecarPreset(opts)

  const args = [
    ...baseArgs(),
    ...formatSelector(opts),
    '-o',
    `${outDir}\\${safeTemplate(s.filenameTemplate)}`,
    '--newline',
    '--no-playlist',
    '--no-simulate',
    '--retries',
    '10',
    '--fragment-retries',
    '10',
    '--concurrent-fragments',
    String(Math.max(1, s.fragmentConcurrency)),
    // Cac truong dung dau phay la co che "du phong" cua yt-dlp: lay truong dau
    // tien co gia tri. total_bytes chi biet voi file don, HLS thi chi co estimate.
    '--progress-template',
    `download:${PROGRESS_TAG}%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`
  ]

  if (ffmpeg) args.push('--ffmpeg-location', ffmpeg)
  if (s.rateLimit) args.push('--limit-rate', s.rateLimit)

  if (!audioOnly && !sidecar) {
    args.push('--merge-output-format', opts.container)
    // Neu ket qua khong phai container mong muon (vd webm) thi remux lai.
    // Remux chi doi vo chua nen khong giam chat luong.
    args.push('--remux-video', opts.container)
  }

  const wantSubs = opts.writeSubs || opts.preset === 'subtitles'
  if (wantSubs) {
    args.push('--write-subs')
    if (opts.autoSubs) args.push('--write-auto-subs')
    args.push('--sub-langs', opts.subLangs || 'vi,en')
    args.push('--convert-subs', opts.subFormat)
    if (opts.embedSubs && !audioOnly && !sidecar) args.push('--embed-subs')
  }

  if (opts.preset === 'thumbnail') {
    args.push('--write-thumbnail')
  } else if (opts.embedThumbnail && !sidecar) {
    args.push('--embed-thumbnail')
  }
  if (opts.embedMetadata && !sidecar) args.push('--embed-metadata')

  args.push('--', safeUrl)

  const child = spawn(exe, args, { windowsHide: true })
  let lastFile: string | null = null
  let stderrTail = ''

  const handleLine = (line: string): void => {
    const text = line.trim()
    if (!text) return

    if (text.startsWith(PROGRESS_TAG)) {
      const [status, dl, total, speed, eta] = text.slice(PROGRESS_TAG.length).split('|')
      const num = (v: string): number | null => {
        const n = Number(v)
        return Number.isFinite(n) && v !== 'NA' && v !== '' ? n : null
      }
      const downloaded = num(dl) ?? 0
      const totalBytes = num(total)
      ev.onProgress({
        percent: totalBytes ? Math.min(100, (downloaded / totalBytes) * 100) : 0,
        downloadedBytes: downloaded,
        totalBytes,
        speed: num(speed),
        eta: num(eta)
      })
      if (status === 'finished') ev.onStage('Đang xử lý...')
      return
    }

    // Bat duong dan file o moi giai doan; buoc sau ghi de buoc truoc nen
    // gia tri cuoi cung chinh la file hoan chinh.
    const dest = text.match(/^\[(?:download|ExtractAudio|VideoRemuxer)\]\s+Destination:\s+(.+)$/)
    if (dest) lastFile = dest[1].trim()
    const merger = text.match(/^\[Merger\]\s+Merging formats into "(.+)"$/)
    if (merger) lastFile = merger[1].trim()
    const already = text.match(/^\[download\]\s+(.+) has already been downloaded$/)
    if (already) lastFile = already[1].trim()
    const moved = text.match(/^\[(?:MoveFiles|VideoConvertor)\].*to\s+"?(.+?)"?$/)
    if (moved) lastFile = moved[1].trim()
    const thumb = text.match(/^\[info\]\s+Writing video thumbnail .* to:\s+(.+)$/)
    if (thumb && opts.preset === 'thumbnail') lastFile = thumb[1].trim()
    const subFile = text.match(/^\[info\]\s+Writing video subtitles to:\s+(.+)$/)
    if (subFile && opts.preset === 'subtitles') lastFile = subFile[1].trim()

    if (text.startsWith('[Merger]')) ev.onStage('Đang ghép video + âm thanh')
    else if (text.startsWith('[ExtractAudio]')) ev.onStage('Đang trích xuất âm thanh')
    else if (text.startsWith('[EmbedSubtitle]')) ev.onStage('Đang nhúng phụ đề')
    else if (text.startsWith('[EmbedThumbnail]')) ev.onStage('Đang nhúng ảnh bìa')
    else if (text.startsWith('[Metadata]')) ev.onStage('Đang ghi metadata')
    else if (text.startsWith('[VideoRemuxer]')) ev.onStage('Đang đổi vỏ chứa')
    else if (text.startsWith('[SubtitlesConvertor]')) ev.onStage('Đang chuyển đổi phụ đề')
  }

  let stdoutBuf = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString()
    const lines = stdoutBuf.split(/\r?\n/)
    stdoutBuf = lines.pop() ?? ''
    lines.forEach(handleLine)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    stderrTail = (stderrTail + text).slice(-8000)
    text.split(/\r?\n/).forEach(handleLine)
  })

  const promise = new Promise<string | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (stdoutBuf.trim()) handleLine(stdoutBuf)
      if (code === 0) {
        if (lastFile) ev.onFile(lastFile)
        resolve(lastFile)
      } else if (signal || code === null) {
        reject(new Error('CANCELED'))
      } else {
        reject(new Error(stderrTail || `yt-dlp thoát với mã ${code}`))
      }
    })
  })

  return { child, promise }
}
