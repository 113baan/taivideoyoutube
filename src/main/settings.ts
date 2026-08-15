import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { JobOptions, Settings } from '../shared/types'

let cache: Settings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function defaultSettings(): Settings {
  return {
    /* General */
    outputDir: join(app.getPath('downloads'), 'VidGrab'),
    autoStartDownload: true,
    minimizeToTray: false,
    launchAtStartup: false,

    /* Download */
    filenameTemplate: '%(title).150B [%(id)s].%(ext)s',
    concurrency: 2,
    fragmentConcurrency: 4,
    rateLimit: '',

    /* Video */
    defaultPreset: 'best',
    container: 'mp4',
    codecPreference: 'auto',

    /* Audio */
    audioFormat: 'mp3',
    audioQuality: 'best',

    /* Subtitles */
    writeSubs: false,
    autoSubs: true,
    subLangs: 'vi,en',
    subFormat: 'srt',
    embedSubs: false,

    /* Cookies — chi luu ten trinh duyet hoac duong dan file, khong bao gio
       luu noi dung cookie trong cau hinh cua app. */
    cookiesFromBrowser: '',
    cookieFile: '',

    /* Advanced */
    embedThumbnail: true,
    embedMetadata: true,
    proxy: '',
    ffmpegPath: ''
  }
}

export function getSettings(): Settings {
  if (cache) return cache
  const defaults = defaultSettings()
  try {
    if (existsSync(settingsFile())) {
      const raw = JSON.parse(readFileSync(settingsFile(), 'utf-8'))
      // Merge nong: cac khoa moi them trong ban cap nhat van co gia tri mac dinh.
      cache = { ...defaults, ...raw }
    } else {
      cache = defaults
    }
  } catch {
    cache = defaults
  }
  return cache!
}

export function saveSettings(next: Partial<Settings>): Settings {
  const merged = { ...getSettings(), ...next }
  cache = merged
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), 'utf-8')
  } catch (err) {
    console.error('Khong luu duoc settings:', err)
  }
  return merged
}

export function resetSettings(): Settings {
  cache = defaultSettings()
  persistCurrent()
  return cache
}

function persistCurrent(): void {
  try {
    writeFileSync(settingsFile(), JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    /* bo qua */
  }
}

/** Tao thu muc dich neu chua co, tra ve duong dan da chac chan ton tai. */
export function ensureOutputDir(dir?: string): string {
  const target = dir && dir.trim() ? dir : getSettings().outputDir
  mkdirSync(target, { recursive: true })
  return target
}

/**
 * Dung JobOptions mac dinh tu Settings. Renderer chi can ghi de vai truong,
 * nho vay them tuy chon moi khong phai sua moi noi goi.
 */
export function defaultJobOptions(overrides: Partial<JobOptions> = {}): JobOptions {
  const s = getSettings()
  return {
    preset: s.defaultPreset,
    container: s.container,
    codecPreference: s.codecPreference,
    audioFormat: s.audioFormat,
    audioQuality: s.audioQuality,
    writeSubs: s.writeSubs,
    autoSubs: s.autoSubs,
    subLangs: s.subLangs,
    subFormat: s.subFormat,
    embedSubs: s.embedSubs,
    embedThumbnail: s.embedThumbnail,
    embedMetadata: s.embedMetadata,
    ...overrides
  }
}
