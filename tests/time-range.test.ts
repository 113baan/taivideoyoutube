import { describe, expect, it } from 'vitest'
import {
  clampToDuration,
  formatClock,
  parseClock,
  rangeFilenameSuffix,
  toDownloadSection,
  validateRange
} from '../src/main/services/TimeRangeService'

describe('parseClock — chap nhan moi cach nguoi dung go', () => {
  it('nhan dang mm:ss', () => {
    expect(parseClock('1:00')).toBe(60)
    expect(parseClock('01:00')).toBe(60)
    expect(parseClock('12:35')).toBe(755)
  })

  it('nhan dang hh:mm:ss', () => {
    expect(parseClock('00:01:00')).toBe(60)
    expect(parseClock('1:30:00')).toBe(5400)
    expect(parseClock('10:20:30')).toBe(37230)
  })

  it('so tran la tong so giay', () => {
    expect(parseClock('90')).toBe(90)
    expect(parseClock('0')).toBe(0)
  })

  it('chap nhan phan thap phan o truong giay', () => {
    expect(parseClock('1:30.5')).toBe(90.5)
    expect(parseClock('2.25')).toBe(2.25)
  })

  it('bo qua khoang trang thua', () => {
    expect(parseClock('  1:00  ')).toBe(60)
  })

  it('tra ve null voi dau vao khong hop le', () => {
    expect(parseClock('')).toBeNull()
    expect(parseClock('abc')).toBeNull()
    expect(parseClock('-5')).toBeNull()
    expect(parseClock('1:2:3:4')).toBeNull()
    expect(parseClock('::')).toBeNull()
  })

  it('tu choi truong phut/giay vuot 59 khi co nhieu truong', () => {
    expect(parseClock('1:60')).toBeNull()
    expect(parseClock('1:75:00')).toBeNull()
  })
})

describe('formatClock — luon chuan hoa ve HH:MM:SS', () => {
  it('dinh dang dung', () => {
    expect(formatClock(0)).toBe('00:00:00')
    expect(formatClock(60)).toBe('00:01:00')
    expect(formatClock(755)).toBe('00:12:35')
    expect(formatClock(37230)).toBe('10:20:30')
  })

  it('lam tron phan thap phan xuong giay nguyen', () => {
    expect(formatClock(90.7)).toBe('00:01:30')
  })

  it('parse roi format la phep bien doi on dinh', () => {
    for (const input of ['1:00', '00:01:00', '90', '12:35']) {
      const seconds = parseClock(input)!
      expect(parseClock(formatClock(seconds))).toBe(Math.floor(seconds))
    }
  })
})

describe('validateRange — quy tac start >= 0, end > start, end <= duration', () => {
  it('chap nhan khoang hop le', () => {
    expect(validateRange(60, 180, 755).ok).toBe(true)
  })

  it('tu choi start am', () => {
    const r = validateRange(-1, 60, 755)
    expect(r.ok).toBe(false)
    expect(r.field).toBe('start')
  })

  it('tu choi end <= start', () => {
    expect(validateRange(60, 60, 755).ok).toBe(false)
    expect(validateRange(120, 60, 755).ok).toBe(false)
    expect(validateRange(120, 60, 755).field).toBe('end')
  })

  it('bao loi khi end vuot thoi luong, kem thoi luong that trong thong bao', () => {
    const r = validateRange(480, 900, 620)
    expect(r.ok).toBe(false)
    expect(r.field).toBe('end')
    // Theo muc 13: phai noi ro video dai bao nhieu.
    expect(r.message).toContain('00:10:20')
  })

  it('tu choi start vuot thoi luong', () => {
    expect(validateRange(900, 1000, 620).ok).toBe(false)
  })

  it('bo qua kiem tra thoi luong khi chua biet duration', () => {
    expect(validateRange(60, 180, null).ok).toBe(true)
    expect(validateRange(60, 999999, null).ok).toBe(true)
  })
})

describe('clampToDuration — playlist co video ngan hon (muc 89)', () => {
  it('cat end ve dung thoi luong thay vi bao loi ca playlist', () => {
    // Video dai 01:42, nguoi dung chon 01:00 -> 03:00
    const r = clampToDuration(60, 180, 102)
    expect(r.end).toBe(102)
    expect(r.clamped).toBe(true)
  })

  it('giu nguyen khi khoang nam gon trong video', () => {
    const r = clampToDuration(60, 180, 755)
    expect(r.end).toBe(180)
    expect(r.clamped).toBe(false)
  })

  it('bao khong the ap dung khi start vuot qua thoi luong', () => {
    expect(clampToDuration(200, 300, 102).skip).toBe(true)
  })

  it('khong doi gi khi chua biet thoi luong', () => {
    const r = clampToDuration(60, 180, null)
    expect(r.end).toBe(180)
    expect(r.clamped).toBe(false)
  })
})

describe('toDownloadSection — sinh tham so cho yt-dlp', () => {
  it('dung dinh dang *START-END', () => {
    expect(toDownloadSection(60, 180)).toBe('*00:01:00-00:03:00')
    expect(toDownloadSection(0, 10)).toBe('*00:00:00-00:00:10')
  })

  it('dung inf khi tai den het video', () => {
    expect(toDownloadSection(60, null)).toBe('*00:01:00-inf')
  })
})

describe('rangeFilenameSuffix — hau to ten file (muc 86)', () => {
  it('sinh hau to doc duoc', () => {
    expect(rangeFilenameSuffix(60, 180)).toBe('[01m00s-03m00s]')
    expect(rangeFilenameSuffix(0, 10)).toBe('[00m00s-00m10s]')
  })

  it('gom gio vao phut de ten file khong qua dai', () => {
    expect(rangeFilenameSuffix(3660, 3720)).toBe('[61m00s-62m00s]')
  })

  it('khong chua ky tu bi cam tren Windows', () => {
    const suffix = rangeFilenameSuffix(60, 180)
    expect(suffix).not.toMatch(/[:*?"<>|/\\]/)
  })
})
