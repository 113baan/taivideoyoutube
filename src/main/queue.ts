import { randomUUID } from 'crypto'
import { execFile, type ChildProcess } from 'child_process'
import { statSync } from 'fs'
import type { Job, JobOptions, JobStatus } from '../shared/types'
import { classifyError, simpleError } from './errors'
import { addFromJob } from './history'
import { sanitizeSegment } from './services/FilenameService'
import { getSettings } from './settings'
import { startDownload } from './ytdlp'

export interface NewJob {
  url: string
  title: string
  thumbnail: string | null
  uploader: string | null
  extractor: string
  qualityLabel: string
  options: JobOptions
}

type Listener = (jobs: Job[]) => void

const jobs: Job[] = []
/** Tien trinh dang chay, khoa theo job id. */
const running = new Map<string, ChildProcess>()
/**
 * Job da duoc khoi dong nhung co the chua kip spawn xong.
 * Phai tach khoi `running` vi `startDownload` la ham bat dong bo: neu dem bang
 * `running.size`, pump() se thay 0 va khoi dong toan bo hang doi cung luc.
 */
const starting = new Set<string>()
const listeners = new Set<Listener>()

/** Gom nhieu thay doi trong cung mot tick thanh 1 lan gui sang renderer. */
let flushTimer: NodeJS.Timeout | null = null
function notify(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    const snapshot = jobs.map((j) => ({ ...j }))
    listeners.forEach((l) => l(snapshot))
  }, 120)
}

export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getJobs(): Job[] {
  return jobs.map((j) => ({ ...j }))
}

function update(id: string, patch: Partial<Job>): void {
  const job = jobs.find((j) => j.id === id)
  if (!job) return
  Object.assign(job, patch)
  notify()
}

function makeJob(item: NewJob): Job {
  return {
    id: randomUUID(),
    url: item.url,
    title: item.title,
    thumbnail: item.thumbnail,
    uploader: item.uploader,
    extractor: item.extractor,
    qualityLabel: item.qualityLabel,
    options: item.options,
    status: 'queued' as JobStatus,
    percent: 0,
    downloadedBytes: 0,
    totalBytes: null,
    speed: null,
    eta: null,
    outputFile: null,
    fileSize: null,
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    stage: 'Đang chờ'
  }
}

/**
 * Them job vao hang doi. `front` dat job len dau hang — dung cho nut Tải xuống
 * chinh, de nguoi dung thay no chay ngay thay vi xep sau cac job cu.
 */
export function enqueue(items: NewJob[], front = false): Job[] {
  const created = items.map(makeJob)
  if (front) jobs.unshift(...created)
  else jobs.push(...created)
  notify()
  pump()
  return created
}

/** So job dang chiem mot suat tai. */
function activeCount(): number {
  return running.size + starting.size
}

/** Khoi dong them job cho toi khi dat gioi han so luong chay song song. */
function pump(): void {
  if (!getSettings().autoStartDownload) return
  const limit = Math.max(1, getSettings().concurrency)
  while (activeCount() < limit) {
    const next = jobs.find((j) => j.status === 'queued')
    if (!next) return
    void run(next)
  }
}

async function run(job: Job): Promise<void> {
  // Danh dau dong bo NGAY tai day: pump() dua vao con so nay de dem suat chay.
  starting.add(job.id)
  update(job.id, { status: 'preparing', stage: 'Đang chuẩn bị', error: null })

  try {
    const handle = await startDownload(job.url, job.options, {
      onProgress: (p) =>
        update(job.id, {
          status: 'running',
          percent: p.percent,
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speed: p.speed,
          eta: p.eta,
          stage: 'Đang tải'
        }),
      onStage: (stage) => update(job.id, { status: 'processing', stage, speed: null, eta: null }),
      onFile: (path) => update(job.id, { outputFile: path })
    })

    running.set(job.id, handle.child)
    starting.delete(job.id)

    // Nguoi dung co the bam Huy/Tam dung trong khoang spawn chua xong o tren.
    // Truong hop do trang thai da doi, phai dung tien trinh vua sinh ra.
    const current = jobs.find((j) => j.id === job.id)
    if (!current || current.status === 'canceled' || current.status === 'paused') {
      killTree(handle.child)
      running.delete(job.id)
      return
    }

    const file = await handle.promise
    running.delete(job.id)

    let size: number | null = null
    if (file) {
      try {
        size = statSync(file).size
      } catch {
        /* file co the da bi di chuyen */
      }
    }

    update(job.id, {
      status: 'done',
      percent: 100,
      stage: 'Hoàn tất',
      speed: null,
      eta: null,
      outputFile: file,
      fileSize: size,
      finishedAt: Date.now()
    })

    const finished = jobs.find((j) => j.id === job.id)
    if (finished) addFromJob(finished)
  } catch (err) {
    const message = (err as Error).message

    if (message === 'CANCELED') {
      // Tien trinh bi giet: co the do Huy, cung co the do Tam dung.
      const current = jobs.find((j) => j.id === job.id)
      if (current?.status !== 'paused') {
        update(job.id, { status: 'canceled', stage: 'Đã hủy', speed: null, eta: null })
      }
    } else if (message === 'YTDLP_MISSING') {
      update(job.id, {
        status: 'error',
        stage: 'Thiếu engine',
        speed: null,
        eta: null,
        finishedAt: Date.now(),
        error: simpleError(
          'Chưa cài engine yt-dlp',
          'VidGrab cần yt-dlp để tải video.',
          'Mở Cài đặt > Engine và bấm Cài đặt engine.'
        )
      })
    } else {
      update(job.id, {
        status: 'error',
        stage: 'Lỗi',
        speed: null,
        eta: null,
        finishedAt: Date.now(),
        error: classifyError(message)
      })
    }
  } finally {
    starting.delete(job.id)
    running.delete(job.id)
    pump()
  }
}

/**
 * yt-dlp sinh tien trinh con (ffmpeg). process.kill tren Windows chi giet
 * tien trinh cha, de lai ffmpeg treo; taskkill /T /F dung ca cay tien trinh.
 */
function killTree(child: ChildProcess): void {
  if (!child.pid) return
  try {
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {})
  } catch {
    /* tien trinh da thoat */
  }
}

function stopProcess(id: string): void {
  const child = running.get(id)
  if (child) {
    killTree(child)
    running.delete(id)
  }
}

const STOPPABLE: JobStatus[] = ['queued', 'preparing', 'running', 'processing']

export function cancel(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (job && STOPPABLE.includes(job.status)) {
    update(id, { status: 'canceled', stage: 'Đã hủy', speed: null, eta: null })
  }
  stopProcess(id)
  pump()
}

/**
 * Tam dung = dung tien trinh nhung giu lai file .part tren dia.
 * Khi chay lai, yt-dlp mac dinh tiep tuc tu cho do (--continue), nen khong mat
 * phan da tai. Voi video chia manh, cac manh da tai xong cung duoc giu lai.
 */
export function pause(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job || !STOPPABLE.includes(job.status)) return
  update(id, { status: 'paused', stage: 'Đã tạm dừng', speed: null, eta: null })
  stopProcess(id)
  pump()
}

export function resume(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job || job.status !== 'paused') return
  update(id, { status: 'queued', stage: 'Đang chờ', error: null })
  pump()
}

export function retry(id: string): void {
  const job = jobs.find((j) => j.id === id)
  if (!job || running.has(id) || starting.has(id)) return
  update(id, {
    status: 'queued',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: null,
    speed: null,
    eta: null,
    error: null,
    outputFile: null,
    fileSize: null,
    finishedAt: null,
    stage: 'Đang chờ'
  })
  pump()
}

export function remove(id: string): void {
  stopProcess(id)
  const idx = jobs.findIndex((j) => j.id === id)
  if (idx >= 0) jobs.splice(idx, 1)
  notify()
  pump()
}

export function clearFinished(): void {
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (['done', 'error', 'canceled'].includes(jobs[i].status)) jobs.splice(i, 1)
  }
  notify()
}

export function pauseAll(): void {
  jobs.filter((j) => STOPPABLE.includes(j.status)).forEach((j) => pause(j.id))
}

export function resumeAll(): void {
  jobs.filter((j) => j.status === 'paused').forEach((j) => resume(j.id))
}

export function retryAllFailed(): void {
  jobs.filter((j) => j.status === 'error').forEach((j) => retry(j.id))
}

export function cancelAll(): void {
  jobs.filter((j) => STOPPABLE.includes(j.status)).forEach((j) => cancel(j.id))
}

/**
 * Tien to ten file cua cac job con song trong hang doi — TempManager dung
 * danh sach nay de KHONG xoa file .part cua job dang tam dung hoac dang tai.
 *
 * Lay tien to ngan (40 ky tu) thay vi ca ten: khop rong hon nghia la bao ve
 * nhieu hon, va sai lam ve phia giu lai thi vo hai, con xoa nham thi mat du lieu.
 */
export function getProtectedPrefixes(): string[] {
  return jobs
    .filter((j) => j.status !== 'done')
    .map((j) => sanitizeSegment(j.title).slice(0, 40))
    .filter((p) => p.length > 0)
}

/** Dung moi tien trinh khi thoat app, tranh de lai yt-dlp/ffmpeg chay ngam. */
export function shutdown(): void {
  running.forEach((child) => killTree(child))
  running.clear()
  starting.clear()
}
