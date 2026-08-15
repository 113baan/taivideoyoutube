import { describe, expect, it } from 'vitest'
import { audioQualityArg, formatSelector, sortExpression } from '../src/main/services/FormatService'
import type { JobOptions } from '../src/shared/types'

/**
 * GOLDEN TEST — chot cung duong ong tai da duoc kiem chung bang download that
 * (da xac minh ra file 3840x2160@60 VP9 + AAC 5.1).
 *
 * Bat ky thay doi nao lam do bo test nay deu co nghia la da doi hanh vi tai,
 * chu khong phai "test cu". Chi sua ky vong o day khi CO CHU DICH doi pipeline
 * va da chay lai download thuc te de xac nhan.
 */

const base: JobOptions = {
  preset: 'best',
  container: 'mp4',
  codecPreference: 'auto',
  audioFormat: 'mp3',
  audioQuality: 'best',
  writeSubs: false,
  autoSubs: true,
  subLangs: 'vi,en',
  subFormat: 'srt',
  embedSubs: false,
  embedThumbnail: true,
  embedMetadata: true
}

const withOpts = (o: Partial<JobOptions>): JobOptions => ({ ...base, ...o })

describe('sortExpression — thu tu uu tien truyen cho -S', () => {
  it('auto uu tien do phan giai truoc codec (khac mac dinh cua yt-dlp)', () => {
    expect(sortExpression(withOpts({ codecPreference: 'auto' }))).toBe('res,fps,hdr:12,br')
  })

  it('tung codec cu the', () => {
    expect(sortExpression(withOpts({ codecPreference: 'av1' }))).toBe('res,fps,hdr:12,vcodec:av01,br')
    expect(sortExpression(withOpts({ codecPreference: 'vp9' }))).toBe('res,fps,hdr:12,vcodec:vp9,br')
  })

  it('h264 bo hdr vi H.264 khong co ban HDR', () => {
    const s = sortExpression(withOpts({ codecPreference: 'h264' }))
    expect(s).toBe('res,fps,vcodec:h264,acodec:aac,br')
    expect(s).not.toContain('hdr')
  })
})

describe('formatSelector — golden args cho tung preset', () => {
  it('best', () => {
    expect(formatSelector(withOpts({ preset: 'best' }))).toEqual([
      '-f', 'bv*+ba/b', '-S', 'res,fps,hdr:12,br'
    ])
  })

  it('best-mp4 luon ep h264/aac bat ke codecPreference', () => {
    expect(formatSelector(withOpts({ preset: 'best-mp4', codecPreference: 'av1' }))).toEqual([
      '-f', 'bv*+ba/b', '-S', 'res,fps,vcodec:h264,acodec:aac,br'
    ])
  })

  it('cac muc gioi han do phan giai co du phong khi khong dat toi', () => {
    expect(formatSelector(withOpts({ preset: '2160' }))).toEqual([
      '-f', 'bv*[height<=2160]+ba/b[height<=2160]/bv*+ba/b', '-S', 'res,fps,hdr:12,br'
    ])
    expect(formatSelector(withOpts({ preset: '720' }))).toEqual([
      '-f', 'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b', '-S', 'res,fps,hdr:12,br'
    ])
  })

  it('moi muc gioi han deu ket thuc bang du phong bv*+ba/b', () => {
    for (const preset of ['2160', '1440', '1080', '720', '480'] as const) {
      const args = formatSelector(withOpts({ preset }))
      expect(args[1].endsWith('/bv*+ba/b')).toBe(true)
      expect(args[1]).toContain(`height<=${preset}`)
    }
  })

  it('audio lay dinh dang tu Settings', () => {
    expect(formatSelector(withOpts({ preset: 'audio', audioFormat: 'mp3' }))).toEqual([
      '-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0'
    ])
  })

  it('m4a uu tien luong m4a san co de khoi chuyen ma', () => {
    expect(formatSelector(withOpts({ preset: 'audio', audioFormat: 'm4a' }))).toEqual([
      '-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a', '--audio-quality', '0'
    ])
  })

  it('wav bo qua tham so chat luong vi khong nen', () => {
    const args = formatSelector(withOpts({ preset: 'audio', audioFormat: 'wav' }))
    expect(args).toEqual(['-f', 'ba/b', '-x', '--audio-format', 'wav'])
    expect(args).not.toContain('--audio-quality')
  })

  it('bitrate cu the doi sang dang K', () => {
    expect(audioQualityArg(withOpts({ audioQuality: '320' }))).toBe('320K')
    expect(audioQualityArg(withOpts({ audioQuality: 'best' }))).toBe('0')
  })

  it('preset audio cu trong cau hinh da luu van chay dung', () => {
    // Nguoi dung nang cap tu ban truoc co the con 'audio-mp3' trong settings.json.
    expect(formatSelector(withOpts({ preset: 'audio-mp3', audioFormat: 'opus' }))).toEqual([
      '-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0'
    ])
    expect(formatSelector(withOpts({ preset: 'audio-m4a' }))).toEqual([
      '-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a', '--audio-quality', '0'
    ])
  })

  it('phu de va anh bia khong tai luong media nao', () => {
    expect(formatSelector(withOpts({ preset: 'subtitles' }))).toEqual(['--skip-download'])
    expect(formatSelector(withOpts({ preset: 'thumbnail' }))).toEqual(['--skip-download'])
  })

  it('custom ghep video + audio bang dau cong', () => {
    expect(
      formatSelector(withOpts({ preset: 'custom', videoFormatId: '315', audioFormatId: '251' }))
    ).toEqual(['-f', '315+251'])
  })

  it('custom chi co video thi dung mot minh', () => {
    expect(formatSelector(withOpts({ preset: 'custom', videoFormatId: '18' }))).toEqual(['-f', '18'])
  })

  it('custom khong chon gi thi quay ve best', () => {
    expect(formatSelector(withOpts({ preset: 'custom' }))).toEqual([
      '-f', 'bv*+ba/b', '-S', 'res,fps,hdr:12,br'
    ])
  })

  it('khong bao gio hard-code format ID trong cac preset thuong (muc 9)', () => {
    for (const preset of ['best', 'best-mp4', '2160', '1080', '720', 'audio'] as const) {
      const joined = formatSelector(withOpts({ preset })).join(' ')
      // Format ID cua yt-dlp la so tran nhu 137/248/251 — khong duoc xuat hien.
      expect(joined).not.toMatch(/(^|\s)-f\s+\d+(\s|$)/)
    }
  })
})
