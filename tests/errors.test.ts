import { describe, expect, it } from 'vitest'
import { classifyError } from '../src/main/errors'

/**
 * Moi quy tac dich loi deu duoc chot bang stderr THAT tu yt-dlp, sao chep
 * nguyen van tu cac lan chay thuc te. Khong dung chuoi bia.
 */

describe('classifyError — nen tang tra ve trang trong', () => {
  // Nguyen van tu lan chay that voi link TikTok cua nguoi dung.
  const tiktok =
    'ERROR: [TikTok] 7673020733341060373: Unexpected response from webpage request; ' +
    'please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q= , ' +
    'filling out the appropriate issue template. Confirm you are on the latest version using  yt-dlp -U'

  it('khong roi vao nhanh du phong "loi khong xac dinh"', () => {
    const e = classifyError(tiktok)
    expect(e.title).not.toBe('Không thể tải video')
  })

  it('chi dung nguyen nhan la trang khong tra ve du lieu video', () => {
    expect(classifyError(tiktok).title).toBe('Nền tảng không trả về dữ liệu video')
  })

  it('dan nguoi dung toi cai dat cookie', () => {
    expect(classifyError(tiktok).action).toBe('cookies')
  })

  it('giu lai stderr goc de chan doan', () => {
    expect(classifyError(tiktok).technical).toContain('Unexpected response')
  })
})

describe('classifyError — ba loi cookie khac nhau phai cho ba loi khuyen khac nhau', () => {
  const dpapi = 'ERROR: Failed to decrypt with DPAPI. See https://github.com/yt-dlp/yt-dlp/issues/10927'
  const locked = 'ERROR: Could not copy Chrome cookie database. See https://github.com/yt-dlp/yt-dlp/issues/7271'
  const missing =
    "ERROR: could not find firefox cookies database in 'C:\\Users\\X\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles'"

  it('DPAPI: KHONG duoc khuyen dong trinh duyet vi khong khac phuc duoc', () => {
    const e = classifyError(dpapi)
    expect(e.title).toBe('Chrome khóa cookie bằng mã hóa mới')
    expect(e.hint).not.toMatch(/đóng.*trình duyệt/i)
  })

  it('file bi khoa: dung la khuyen dong trinh duyet', () => {
    const e = classifyError(locked)
    expect(e.title).toBe('Không đọc được cookie trình duyệt')
    expect(e.hint).toMatch(/đóng/i)
    expect(e.action).toBe('retry')
  })

  it('khong tim thay profile: khuyen doi trinh duyet', () => {
    expect(classifyError(missing).title).toBe('Không tìm thấy dữ liệu cookie')
  })

  it('ba loi cho ra ba tieu de khac nhau', () => {
    const titles = [dpapi, locked, missing].map((s) => classifyError(s).title)
    expect(new Set(titles).size).toBe(3)
  })
})

describe('classifyError — cac loi thuong gap khac', () => {
  it('yeu cau xac thuc', () => {
    const e = classifyError('ERROR: Sign in to confirm you are not a bot')
    expect(e.action).toBe('cookies')
  })

  it('video rieng tu', () => {
    expect(classifyError('ERROR: Private video. Sign in if you have been granted access').action).toBe(
      'cookies'
    )
  })

  it('video da bi xoa', () => {
    const e = classifyError('ERROR: Video unavailable. This video has been removed by the uploader')
    expect(e.title).toBe('Video không còn tồn tại')
    expect(e.action).toBe('none')
  })

  it('bi gioi han toc do', () => {
    expect(classifyError('ERROR: HTTP Error 429: Too Many Requests').action).toBe('retry')
  })

  it('dia day', () => {
    expect(classifyError('OSError: [Errno 28] No space left on device').title).toBe('Ổ đĩa đã đầy')
  })

  it('loi la van co thong bao dung cau truc, khong de trong', () => {
    const e = classifyError('ERROR: something nobody has seen before')
    expect(e.title).toBeTruthy()
    expect(e.cause).toBeTruthy()
    expect(e.hint).toBeTruthy()
    expect(e.technical).toContain('nobody has seen')
  })
})
