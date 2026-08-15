/** Kieu du lieu dung chung giua main process va renderer. */

export type QualityPreset =
  | 'best'          // Chat luong cao nhat, khong gioi han
  | 'best-mp4'      // Cao nhat nhung uu tien H.264/AAC de tuong thich moi thiet bi
  | '2160'
  | '1440'
  | '1080'
  | '720'
  | '480'
  | 'audio'         // Chi am thanh, dinh dang lay tu Settings
  | 'audio-mp3'     // Giu lai cho cau hinh cu da luu tren dia
  | 'audio-m4a'
  | 'subtitles'     // Chi tai phu de
  | 'thumbnail'     // Chi tai anh bia
  | 'custom'        // Nguoi dung tu chon format_id trong bang Advanced

export type Container = 'mp4' | 'mkv' | 'webm'
export type AudioFormat = 'mp3' | 'm4a' | 'opus' | 'wav'
export type AudioQuality = 'best' | '320' | '256' | '192'
export type CodecPreference = 'auto' | 'av1' | 'vp9' | 'h264'
export type SubtitleFormat = 'srt' | 'vtt'
export type BrowserName = '' | 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera' | 'chromium'

export interface FormatRow {
  formatId: string
  ext: string
  resolution: string
  width: number | null
  height: number | null
  fps: number | null
  vcodec: string | null
  acodec: string | null
  /** Byte. null neu yt-dlp khong biet truoc. */
  filesize: number | null
  /** true neu la uoc luong (filesize_approx) chu khong phai so chinh xac. */
  filesizeApprox: boolean
  /** Tong bitrate kbps */
  tbr: number | null
  note: string
  protocol: string
  dynamicRange: string | null
  hasVideo: boolean
  hasAudio: boolean
}

export interface MediaInfo {
  /** URL goc nguoi dung dan vao (dung de tai lai). */
  sourceUrl: string
  /** URL cu the cua video nay (khac sourceUrl khi la 1 muc trong playlist). */
  url: string
  id: string
  title: string
  uploader: string | null
  duration: number | null
  thumbnail: string | null
  /** Ten extractor cua yt-dlp, vd 'Youtube', 'TikTok'. Khong hard-code danh sach. */
  extractor: string
  /** YYYYMMDD do yt-dlp tra ve, hoac null. */
  uploadDate: string | null
  viewCount: number | null
  /** Rong khi la muc playlist chua duoc phan tich chi tiet. */
  formats: FormatRow[]
  /** Ngon ngu phu de co san, vd ['vi', 'en']. */
  subtitles: string[]
  autoSubtitles: string[]
  isPlaylistEntry: boolean
  playlistTitle: string | null
}

export interface ProbeResult {
  sourceUrl: string
  ok: boolean
  error: FriendlyError | null
  items: MediaInfo[]
  /** So muc trong playlist, de hien "Playlist detected - 127 videos". */
  playlistCount: number
}

/**
 * Loi da duoc dich sang ngon ngu nguoi dung. `technical` giu nguyen stderr goc
 * de nguoi dung nang cao xem khi can.
 */
export interface FriendlyError {
  title: string
  cause: string
  hint: string
  /** Goi y hanh dong ma giao dien co the bien thanh nut bam. */
  action: 'cookies' | 'update-engine' | 'retry' | 'none'
  technical: string
}

export interface JobOptions {
  preset: QualityPreset
  /** Chi dung khi preset === 'custom'. */
  videoFormatId?: string
  audioFormatId?: string
  container: Container
  codecPreference: CodecPreference
  audioFormat: AudioFormat
  audioQuality: AudioQuality
  writeSubs: boolean
  autoSubs: boolean
  subLangs: string
  subFormat: SubtitleFormat
  embedSubs: boolean
  embedThumbnail: boolean
  embedMetadata: boolean
  /** Thu muc dich; rong = dung mac dinh trong Cai dat. */
  outputDir?: string
}

export type JobStatus =
  | 'queued'       // Waiting
  | 'preparing'    // Da spawn yt-dlp, chua co byte nao
  | 'running'      // Downloading
  | 'processing'   // Merging / converting bang ffmpeg
  | 'paused'
  | 'done'
  | 'error'
  | 'canceled'

export interface Job {
  id: string
  url: string
  title: string
  thumbnail: string | null
  uploader: string | null
  extractor: string
  /** Nhan chat luong hien thi, vd '2160p60 · VP9'. */
  qualityLabel: string
  options: JobOptions
  status: JobStatus
  /** 0..100 */
  percent: number
  downloadedBytes: number
  totalBytes: number | null
  /** Byte/giay */
  speed: number | null
  /** Giay */
  eta: number | null
  /** Duong dan file cuoi cung sau khi xong. */
  outputFile: string | null
  fileSize: number | null
  error: FriendlyError | null
  createdAt: number
  finishedAt: number | null
  /** Mo ta ngan giai doan dang chay, hien duoi thanh tien trinh. */
  stage: string
}

export interface HistoryEntry {
  id: string
  title: string
  url: string
  thumbnail: string | null
  uploader: string | null
  extractor: string
  qualityLabel: string
  filePath: string
  fileSize: number | null
  downloadedAt: number
  options: JobOptions
}

export interface Settings {
  /* General */
  outputDir: string
  autoStartDownload: boolean
  minimizeToTray: boolean
  launchAtStartup: boolean

  /* Download */
  filenameTemplate: string
  concurrency: number
  fragmentConcurrency: number
  rateLimit: string

  /* Video */
  defaultPreset: QualityPreset
  container: Container
  codecPreference: CodecPreference

  /* Audio */
  audioFormat: AudioFormat
  audioQuality: AudioQuality

  /* Subtitles */
  writeSubs: boolean
  autoSubs: boolean
  subLangs: string
  subFormat: SubtitleFormat
  embedSubs: boolean

  /* Cookies */
  cookiesFromBrowser: BrowserName
  /**
   * Duong dan file cookies.txt (dinh dang Netscape). Duoc uu tien hon
   * cookiesFromBrowser vi doc tu file khong dinh khoa file cua trinh duyet
   * dang chay, cung khong dinh ma hoa app-bound cua Chrome/Edge tu ban 127.
   */
  cookieFile: string

  /* Advanced */
  embedThumbnail: boolean
  embedMetadata: boolean
  proxy: string
  ffmpegPath: string
}

export interface BinaryStatus {
  ytdlp: { path: string | null; version: string | null; ready: boolean; bundled: boolean }
  ffmpeg: { path: string | null; version: string | null; ready: boolean; bundled: boolean }
}

export interface BinaryProgress {
  stage: 'downloading' | 'done' | 'error'
  percent: number
  message: string
}

/** Mot lua chon chat luong da duoc gom nhom san cho nguoi dung pho thong. */
export interface QualityOption {
  key: string
  label: string
  detail: string
  height: number | null
  fps: number | null
  codec: string | null
  hdr: boolean
  hasAudio: boolean
  estimatedSize: number | null
  videoFormatId: string | null
  audioFormatId: string | null
  recommended: boolean
  audioOnly: boolean
}
