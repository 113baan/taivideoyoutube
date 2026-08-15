import { describe, expect, it } from 'vitest'
import { isSectionDownloadFailure } from '../src/main/ytdlp'

/**
 * Quyet dinh chuyen sang cat cuc bo dua tren stderr THAT da ghi lai tu cac
 * lan chay thuc te, khong dung chuoi bia.
 */

describe('isSectionDownloadFailure — nhan dien cat phia may chu that bai', () => {
  // Nguyen van tu lan do that: YouTube tra URL rang buoc client ANDROID_VR,
  // ffmpeg goi lai URL do khong kem dung header nen bi tu choi.
  const ffmpeg403 = [
    '[download] Destination: C:\\out\\seek.mp4',
    '[https @ 000001a4851e5880] HTTP error 403 Forbidden',
    '[in#0 @ 000001a48517dd80] Error opening input: Server returned 403 Forbidden (access denied)',
    'Error opening input files: Server returned 403 Forbidden (access denied)',
    'ERROR: ffmpeg exited with code 3436169992'
  ].join('\n')

  it('nhan ra truong hop ffmpeg bi 403 khi tai theo doan', () => {
    expect(isSectionDownloadFailure(ffmpeg403)).toBe(true)
  })

  it('nhan ra loi mo file dau vao', () => {
    expect(isSectionDownloadFailure('Error opening input file https://...')).toBe(true)
  })

  it('nhan ra ffmpeg thoat voi ma loi', () => {
    expect(isSectionDownloadFailure('ERROR: ffmpeg exited with code 1')).toBe(true)
  })

  it('KHONG chuyen du phong khi video khong ton tai', () => {
    expect(
      isSectionDownloadFailure('ERROR: [youtube] abc: Video unavailable. This video has been removed')
    ).toBe(false)
  })

  it('KHONG chuyen du phong khi can dang nhap — tai tron cung se hong', () => {
    expect(isSectionDownloadFailure('ERROR: Sign in to confirm you are not a bot')).toBe(false)
  })

  it('KHONG chuyen du phong khi dia day', () => {
    expect(isSectionDownloadFailure('OSError: [Errno 28] No space left on device')).toBe(false)
  })

  it('KHONG chuyen du phong voi loi mang thong thuong', () => {
    expect(isSectionDownloadFailure('ERROR: unable to download video data: HTTP Error 403')).toBe(
      false
    )
  })

  it('khong phan biet chu hoa chu thuong', () => {
    expect(isSectionDownloadFailure('ERROR: FFmpeg Exited With Code 8')).toBe(true)
  })
})
