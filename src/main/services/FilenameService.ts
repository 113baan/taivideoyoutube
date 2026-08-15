/**
 * Sinh va lam sach ten file / duong dan dau ra.
 *
 * Module thuan tuy, khong import electron, nen chay duoc trong vitest.
 * Duoc phu boi tests/filename.test.ts.
 */

const DEFAULT_TEMPLATE = '%(title).150B [%(id)s].%(ext)s'
const FALLBACK_NAME = 'video'
const MAX_SEGMENT = 150

/**
 * Ky tu IN DUOC ma Windows cam. Thay bang '_' de giu cau truc ten cho de doc:
 * 'Tap 1: Mo dau' -> 'Tap 1_ Mo dau' van hieu duoc y nghia.
 */
const FORBIDDEN = /[<>:"/\\|?*]/g

/**
 * Ten thiet bi he thong: Windows tu choi tao file mang ten nay, ke ca khi co
 * phan mo rong (CON.txt van hong).
 */
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

/**
 * Xoa han ky tu dieu khien (C0 va DEL) thay vi thay bang '_'.
 * Chung khong mang y nghia hien thi nen thay bang gach duoi chi lam ban ten file.
 *
 * Loc theo ma ky tu thay vi regex escape — ro rang hon va khong the hieu nham.
 */
function stripControl(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x20 && code !== 0x7f) out += ch
  }
  return out
}

/** Lam sach MOT doan duong dan (khong phai ca duong dan — dau '/' se bi bo). */
export function sanitizeSegment(name: string): string {
  let out = stripControl(String(name ?? '')).replace(FORBIDDEN, '_')

  // Windows am tham cat dau cach va dau cham o cuoi ten, gay lech giua ten app
  // nghi minh da ghi va ten thuc te tren dia. Cat truoc cho khop.
  out = out.trim().replace(/[. ]+$/, '').trim()

  if (out.length > MAX_SEGMENT) {
    out = out.slice(0, MAX_SEGMENT).replace(/[. ]+$/, '').trim()
  }

  // Chuoi toan gach duoi (sinh ra tu ten chi gom ky tu cam) khong co y nghia.
  if (/^_+$/.test(out)) out = ''

  if (!out) return FALLBACK_NAME
  if (RESERVED.test(out)) return `${out}_`

  return out
}

/**
 * Mau ten file la cua nguoi dung, nhung khong duoc phep thoat ra khoi thu muc
 * dich. Chi chan di len thu muc cha va duong dan tuyet doi — van cho phep thu
 * muc con vi day la tinh nang hop le cua yt-dlp.
 */
export function safeTemplate(template: string): string {
  const cleaned = String(template ?? '')
    .trim()
    .replace(/\.\.[\\/]/g, '')
    .replace(/\.\./g, '')
    .replace(/^[a-zA-Z]:[\\/]*/, '')
    .replace(/^[\\/]+/, '')
    .trim()

  return cleaned || DEFAULT_TEMPLATE
}

/**
 * Chen hau to khoang thoi gian vao truoc phan mo rong (muc 86).
 * '%(title)s.%(ext)s' + '[01m00s-03m00s]' -> '%(title)s [01m00s-03m00s].%(ext)s'
 */
export function insertRangeSuffix(template: string, suffix: string): string {
  if (!suffix) return template
  const marker = '.%(ext)s'
  const at = template.lastIndexOf(marker)
  if (at === -1) return `${template} ${suffix}`
  return `${template.slice(0, at)} ${suffix}${template.slice(at)}`
}

/**
 * Ten thu muc theo nen tang, lay tu extractor cua yt-dlp chu khong doan tu URL.
 * Trang moi duoc yt-dlp ho tro se tu co thu muc rieng ma khong phai sua code.
 */
const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
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
  generic: 'Khac'
}

export function platformFolder(extractor: string): string {
  const key = String(extractor ?? '').toLowerCase()
  const base = key.split(':')[0]
  const name = PLATFORM_NAMES[key] ?? PLATFORM_NAMES[base] ?? extractor
  return sanitizeSegment(name || 'Khac')
}
