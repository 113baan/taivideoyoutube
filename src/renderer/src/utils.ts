import type { FormatRow, QualityOption, QualityPreset } from '../../shared/types'

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number | null): string {
  if (!bytesPerSec) return '—'
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** ETA hien thi dang dong ho: 00:38 hoac 1:02:15. */
export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  const pad = (n: number): string => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** yt-dlp tra ve upload_date dang YYYYMMDD. */
export function formatUploadDate(raw: string | null): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`
}

export function formatCount(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} triệu`
  if (n >= 1000) return `${(n / 1000).toFixed(1)} nghìn`
  return String(n)
}

/** Rut gon ten codec dai ngoang cua yt-dlp, vd 'avc1.640028' -> 'H.264'. */
export function shortCodec(codec: string | null): string {
  if (!codec) return '—'
  const c = codec.toLowerCase()
  if (c.startsWith('avc1') || c.startsWith('h264')) return 'H.264'
  if (c.startsWith('hev1') || c.startsWith('hvc1') || c.startsWith('h265')) return 'H.265'
  if (c.startsWith('av01')) return 'AV1'
  if (c.startsWith('vp9') || c.startsWith('vp09')) return 'VP9'
  if (c.startsWith('vp8')) return 'VP8'
  if (c.startsWith('mp4a')) return 'AAC'
  if (c.startsWith('opus')) return 'Opus'
  if (c.startsWith('ec-3') || c.startsWith('ac-3')) return 'AC3'
  if (c.startsWith('flac')) return 'FLAC'
  return codec.split('.')[0]
}

/** Tach khoi van ban nhieu dong thanh danh sach URL sach, bo trung lap. */
export function parseUrls(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/[\s\n,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
}

/**
 * Ten nen tang de hien badge. Lay tu extractor cua yt-dlp chu khong doan tu URL,
 * nen trang moi duoc yt-dlp ho tro se tu dong hien dung ten.
 */
const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  'youtube:tab': 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'X',
  x: 'X',
  reddit: 'Reddit',
  twitch: 'Twitch',
  vimeo: 'Vimeo',
  soundcloud: 'SoundCloud',
  dailymotion: 'Dailymotion',
  bilibili: 'Bilibili',
  generic: 'Khác'
}

export function platformName(extractor: string): string {
  if (!extractor) return 'Khác'
  const key = extractor.toLowerCase()
  if (PLATFORM_NAMES[key]) return PLATFORM_NAMES[key]
  const base = key.split(':')[0]
  return PLATFORM_NAMES[base] ?? extractor
}

/** Mau badge theo nen tang; nen tang la se dung mau trung tinh. */
export function platformColor(extractor: string): string {
  switch (platformName(extractor)) {
    case 'YouTube':
      return '#ff4e45'
    case 'Facebook':
      return '#4599ff'
    case 'TikTok':
      return '#25f4ee'
    case 'Instagram':
      return '#e1568f'
    case 'X':
      return '#c9ced9'
    case 'Reddit':
      return '#ff7040'
    case 'Twitch':
      return '#a97bff'
    case 'Vimeo':
      return '#4bc0ff'
    default:
      return '#8e95a4'
  }
}

function bestOf(list: FormatRow[]): FormatRow | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => (b.fps ?? 0) - (a.fps ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0]
}

const CAP_PRESETS: { height: number; preset: QualityPreset; label: string }[] = [
  { height: 2160, preset: '2160', label: '4K' },
  { height: 1440, preset: '1440', label: '1440p' },
  { height: 1080, preset: '1080', label: '1080p' },
  { height: 720, preset: '720', label: '720p' },
  { height: 480, preset: '480', label: '480p' }
]

/**
 * Gom hon 30 format tho thanh vai lua chon nguoi dung hieu ngay.
 * Moi lua chon van anh xa ve mot preset cua duong ong tai da kiem chung —
 * bang format chi tiet chi danh cho che do Nang cao.
 */
export function buildQualityOptions(formats: FormatRow[]): QualityOption[] {
  const videoOnly = formats.filter((f) => f.hasVideo && !f.hasAudio && f.height)
  const combined = formats.filter((f) => f.hasVideo && f.hasAudio && f.height)
  const audioOnly = formats.filter((f) => !f.hasVideo && f.hasAudio)
  const bestAudio = [...audioOnly].sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0))[0] ?? null
  const audioSize = bestAudio?.filesize ?? null

  // Video-only thuong co do phan giai cao hon ban gop san, nhung neu trang chi
  // tra ve ban gop san (TikTok, Instagram...) thi van phai dung no.
  const pool = videoOnly.length > 0 ? videoOnly : combined
  if (pool.length === 0 && !bestAudio) return []

  const options: QualityOption[] = []
  const heights = [...new Set(pool.map((f) => f.height as number))].sort((a, b) => b - a)

  const describe = (f: FormatRow): string =>
    [
      f.width && f.height ? `${f.width}×${f.height}` : `${f.height}p`,
      f.fps ? `${Math.round(f.fps)} FPS` : null,
      shortCodec(f.vcodec),
      f.dynamicRange && f.dynamicRange !== 'SDR' ? f.dynamicRange : null
    ]
      .filter(Boolean)
      .join(' • ')

  const sizeOf = (f: FormatRow): number | null => {
    if (!f.filesize) return null
    return f.hasAudio ? f.filesize : f.filesize + (audioSize ?? 0)
  }

  const top = bestOf(pool.filter((f) => f.height === heights[0]))
  if (top) {
    options.push({
      key: 'best',
      label: 'Chất lượng tốt nhất',
      detail: describe(top),
      height: top.height,
      fps: top.fps,
      codec: shortCodec(top.vcodec),
      hdr: Boolean(top.dynamicRange && top.dynamicRange !== 'SDR'),
      hasAudio: true,
      estimatedSize: sizeOf(top),
      videoFormatId: null,
      audioFormatId: null,
      recommended: true,
      audioOnly: false
    })
  }

  for (const cap of CAP_PRESETS) {
    // Bo qua muc trung voi "tot nhat" va muc khong co format nao dat toi.
    if (cap.height === heights[0]) continue
    const at = pool.filter((f) => (f.height as number) <= cap.height)
    if (at.length === 0) continue
    const maxAt = Math.max(...at.map((f) => f.height as number))
    if (maxAt < cap.height) continue
    const pick = bestOf(at.filter((f) => f.height === maxAt))
    if (!pick) continue
    options.push({
      key: cap.preset,
      label: cap.label,
      detail: describe(pick),
      height: pick.height,
      fps: pick.fps,
      codec: shortCodec(pick.vcodec),
      hdr: Boolean(pick.dynamicRange && pick.dynamicRange !== 'SDR'),
      hasAudio: true,
      estimatedSize: sizeOf(pick),
      videoFormatId: null,
      audioFormatId: null,
      recommended: false,
      audioOnly: false
    })
  }

  if (bestAudio) {
    options.push({
      key: 'audio',
      label: 'Chỉ âm thanh',
      detail: [
        shortCodec(bestAudio.acodec),
        bestAudio.tbr ? `${Math.round(bestAudio.tbr)} kbps` : null
      ]
        .filter(Boolean)
        .join(' • '),
      height: null,
      fps: null,
      codec: shortCodec(bestAudio.acodec),
      hdr: false,
      hasAudio: true,
      estimatedSize: bestAudio.filesize,
      videoFormatId: null,
      audioFormatId: null,
      recommended: false,
      audioOnly: true
    })
  }

  return options
}

/** Do phan giai cao nhat co the tai, de hien tren the xem truoc. */
export function maxResolutionLabel(formats: FormatRow[]): string | null {
  const heights = formats.filter((f) => f.hasVideo && f.height).map((f) => f.height as number)
  if (heights.length === 0) return null
  const max = Math.max(...heights)
  const best = formats.filter((f) => f.height === max)
  const fps = Math.max(...best.map((f) => f.fps ?? 0))
  if (max >= 2160) return fps > 30 ? `4K ${Math.round(fps)}fps` : '4K'
  return fps > 30 ? `${max}p${Math.round(fps)}` : `${max}p`
}
