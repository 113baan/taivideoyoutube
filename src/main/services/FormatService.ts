import type { JobOptions } from '../../shared/types'

/**
 * Dich lua chon cua nguoi dung thanh bieu thuc chon dinh dang cua yt-dlp.
 *
 * Module thuan tuy — khong import electron, khong dung he thong file — nen chay
 * duoc trong vitest. Hanh vi o day duoc chot cung boi tests/format-selector.test.ts;
 * do la luoi an toan cho duong ong tai da kiem chung bang download that.
 *
 * Nguyen tac: KHONG BAO GIO hard-code format ID (137, 248, 251...) vi chung thay
 * doi theo tung video va tung extractor.
 */

/** Thu tu uu tien truyen cho `-S`. */
export function sortExpression(opts: JobOptions): string {
  switch (opts.codecPreference) {
    case 'av1':
      return 'res,fps,hdr:12,vcodec:av01,br'
    case 'vp9':
      return 'res,fps,hdr:12,vcodec:vp9,br'
    case 'h264':
      // H.264 khong co ban HDR, nen bo hdr khoi thu tu uu tien.
      return 'res,fps,vcodec:h264,acodec:aac,br'
    default:
      // Uu tien do phan giai -> fps -> HDR -> bitrate. Day la khac biet chinh
      // so voi mac dinh cua yt-dlp, von uu tien codec hon do phan giai.
      return 'res,fps,hdr:12,br'
  }
}

/** 0 = VBR tot nhat. Cac muc con lai la CBR theo kbps. */
export function audioQualityArg(opts: JobOptions): string {
  return opts.audioQuality === 'best' ? '0' : `${opts.audioQuality}K`
}

/** Dich preset thanh cac tham so `-f` / `-S` / trich xuat am thanh. */
export function formatSelector(opts: JobOptions): string[] {
  const args: string[] = []
  const cap = (h: string): string => `bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`
  const sort = sortExpression(opts)

  switch (opts.preset) {
    case 'best':
      args.push('-f', 'bv*+ba/b', '-S', sort)
      break
    case 'best-mp4':
      args.push('-f', 'bv*+ba/b', '-S', 'res,fps,vcodec:h264,acodec:aac,br')
      break
    case '2160':
    case '1440':
    case '1080':
    case '720':
    case '480':
      args.push('-f', cap(opts.preset), '-S', sort)
      break
    case 'audio':
    case 'audio-mp3':
    case 'audio-m4a': {
      // Preset cu ghi cung dinh dang; preset moi lay tu Settings.
      const fmt =
        opts.preset === 'audio-mp3' ? 'mp3' : opts.preset === 'audio-m4a' ? 'm4a' : opts.audioFormat
      const selector = fmt === 'm4a' ? 'ba[ext=m4a]/ba/b' : 'ba/b'
      args.push('-f', selector, '-x', '--audio-format', fmt)
      if (fmt !== 'wav') args.push('--audio-quality', audioQualityArg(opts))
      break
    }
    case 'subtitles':
    case 'thumbnail':
      // Khong tai luong media nao, chi lay tai nguyen phu.
      args.push('--skip-download')
      break
    case 'custom': {
      const v = opts.videoFormatId
      const a = opts.audioFormatId
      if (v && a) args.push('-f', `${v}+${a}`)
      else if (v) args.push('-f', v)
      else args.push('-f', 'bv*+ba/b', '-S', sort)
      break
    }
  }
  return args
}
