import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { HistoryEntry, Job } from '../shared/types'

const MAX_ENTRIES = 500

let cache: HistoryEntry[] | null = null

function historyFile(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function getHistory(): HistoryEntry[] {
  if (cache) return cache
  try {
    cache = existsSync(historyFile())
      ? (JSON.parse(readFileSync(historyFile(), 'utf-8')) as HistoryEntry[])
      : []
  } catch {
    cache = []
  }
  return cache!
}

function persist(): void {
  try {
    writeFileSync(historyFile(), JSON.stringify(cache ?? [], null, 2), 'utf-8')
  } catch (err) {
    console.error('Khong luu duoc lich su:', err)
  }
}

export function addFromJob(job: Job): HistoryEntry | null {
  if (!job.outputFile) return null
  const list = getHistory()
  const entry: HistoryEntry = {
    id: job.id,
    title: job.title,
    url: job.url,
    thumbnail: job.thumbnail,
    uploader: job.uploader,
    extractor: job.extractor,
    qualityLabel: job.qualityLabel,
    filePath: job.outputFile,
    fileSize: job.fileSize,
    downloadedAt: Date.now(),
    options: job.options
  }
  // Tai lai cung mot file thi thay the ban ghi cu thay vi de trung.
  const dup = list.findIndex((e) => e.filePath === entry.filePath)
  if (dup >= 0) list.splice(dup, 1)
  list.unshift(entry)
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES
  persist()
  return entry
}

export function removeEntry(id: string): void {
  const list = getHistory()
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
    persist()
  }
}

export function clearHistory(): void {
  cache = []
  persist()
}

/** Danh dau muc co file da bi xoa khoi o dia, de giao dien lam mo di. */
export function withExistence(list: HistoryEntry[]): (HistoryEntry & { exists: boolean })[] {
  return list.map((e) => ({ ...e, exists: existsSync(e.filePath) }))
}
