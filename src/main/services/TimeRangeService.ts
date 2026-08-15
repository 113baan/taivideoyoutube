/**
 * Xu ly khoang thoi gian cho tinh nang tai mot doan video.
 *
 * Module thuan tuy, khong phu thuoc Electron hay he thong file, nen chay duoc
 * truc tiep trong vitest. Moi ham o day deu duoc phu boi tests/time-range.test.ts.
 */

export interface RangeValidation {
  ok: boolean
  /** O nhap gay loi, de giao dien to sang dung o do. */
  field?: 'start' | 'end'
  message?: string
}

export interface ClampResult {
  start: number
  end: number | null
  /** true khi end da bi cat ngan lai cho vua thoi luong video. */
  clamped: boolean
  /** true khi start nam ngoai video — khong the ap dung khoang nay. */
  skip: boolean
}

/**
 * Doc thoi diem nguoi dung go. Chap nhan '90', '1:30', '00:01:30', '1:30.5'.
 * Tra ve so giay, hoac null neu khong hop le.
 */
export function parseClock(input: string): number | null {
  const text = String(input ?? '').trim()
  if (!text) return null

  const parts = text.split(':')
  if (parts.length > 3) return null

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) return null
    const isLast = i === parts.length - 1
    // Chi truong cuoi cung duoc mang phan thap phan (giay le).
    const pattern = isLast ? /^\d+(\.\d+)?$/ : /^\d+$/
    if (!pattern.test(part)) return null
    // Voi nhieu truong, cac truong sau truong dau la phut/giay nen phai < 60.
    // '1:60' hay '1:75:00' la loi go, khong nen am tham chuan hoa.
    if (i > 0 && Number(part) >= 60) return null
  }

  const numbers = parts.map(Number)
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null

  if (numbers.length === 1) return numbers[0]
  if (numbers.length === 2) return numbers[0] * 60 + numbers[1]
  return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
}

/** Chuan hoa so giay ve HH:MM:SS — dang duy nhat hien thi trong giao dien. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/**
 * Kiem tra khoang nguoi dung chon. `duration` co the null khi chua biet
 * thoi luong (vd muc playlist chua phan tich) — khi do bo qua kiem tra tran.
 */
export function validateRange(
  start: number,
  end: number,
  duration: number | null
): RangeValidation {
  if (!Number.isFinite(start) || start < 0) {
    return { ok: false, field: 'start', message: 'Thời điểm bắt đầu không hợp lệ.' }
  }
  if (!Number.isFinite(end)) {
    return { ok: false, field: 'end', message: 'Thời điểm kết thúc không hợp lệ.' }
  }
  if (end <= start) {
    return {
      ok: false,
      field: 'end',
      message: 'Thời điểm kết thúc phải lớn hơn thời điểm bắt đầu.'
    }
  }
  if (duration !== null && Number.isFinite(duration)) {
    if (start >= duration) {
      return {
        ok: false,
        field: 'start',
        message: `Thời điểm bắt đầu vượt quá thời lượng video. Video dài ${formatClock(duration)}.`
      }
    }
    if (end > duration) {
      return {
        ok: false,
        field: 'end',
        message: `Thời điểm kết thúc vượt quá thời lượng video. Video dài ${formatClock(duration)}.`
      }
    }
  }
  return { ok: true }
}

/**
 * Ep khoang vao trong thoi luong thuc te cua tung video.
 * Dung cho playlist (muc 89): video ngan hon khoang da chon thi cat bot phan
 * thua thay vi lam hong ca playlist.
 */
export function clampToDuration(
  start: number,
  end: number | null,
  duration: number | null
): ClampResult {
  if (duration === null || !Number.isFinite(duration)) {
    return { start, end, clamped: false, skip: false }
  }
  if (start >= duration) {
    return { start, end, clamped: false, skip: true }
  }
  if (end !== null && end > duration) {
    return { start, end: duration, clamped: true, skip: false }
  }
  return { start, end, clamped: false, skip: false }
}

/** Sinh gia tri cho `--download-sections`. `end = null` nghia la tai den het. */
export function toDownloadSection(start: number, end: number | null): string {
  const to = end === null ? 'inf' : formatClock(end)
  return `*${formatClock(start)}-${to}`
}

/**
 * Hau to gan vao ten file khi tai mot doan (muc 86).
 * Khong dung dau ':' vi Windows cam ky tu nay trong ten file.
 */
export function rangeFilenameSuffix(start: number, end: number): string {
  const label = (seconds: number): string => {
    const total = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(total / 60)
    return `${String(minutes).padStart(2, '0')}m${String(total % 60).padStart(2, '0')}s`
  }
  return `[${label(start)}-${label(end)}]`
}
