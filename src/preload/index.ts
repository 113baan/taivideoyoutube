import { contextBridge, ipcRenderer } from 'electron'
import type {
  BinaryProgress,
  BinaryStatus,
  HistoryEntry,
  Job,
  JobOptions,
  MediaInfo,
  ProbeResult,
  Settings
} from '../shared/types'

export interface NewJobPayload {
  url: string
  title: string
  thumbnail: string | null
  uploader: string | null
  extractor: string
  qualityLabel: string
  options: JobOptions
}

export type HistoryRow = HistoryEntry & { exists: boolean }

/**
 * Be mat API duy nhat ma renderer nhin thay. `ipcRenderer` khong bao gio duoc
 * expose truc tiep: renderer chi goi duoc dung nhung ham liet ke o day.
 */
const api = {
  /* Phan tich */
  analyze: (urls: string[]): Promise<ProbeResult[]> => ipcRenderer.invoke('analyze', urls),
  analyzeSingle: (url: string): Promise<MediaInfo | null> =>
    ipcRenderer.invoke('analyze:single', url),

  /* Tai xuong */
  download: (items: NewJobPayload[], startNow = true): Promise<Job[]> =>
    ipcRenderer.invoke('download', items, startNow),

  /* Hang doi */
  getQueue: (): Promise<Job[]> => ipcRenderer.invoke('queue:list'),
  cancel: (id: string): Promise<void> => ipcRenderer.invoke('queue:cancel', id),
  pause: (id: string): Promise<void> => ipcRenderer.invoke('queue:pause', id),
  resume: (id: string): Promise<void> => ipcRenderer.invoke('queue:resume', id),
  retry: (id: string): Promise<void> => ipcRenderer.invoke('queue:retry', id),
  removeJob: (id: string): Promise<void> => ipcRenderer.invoke('queue:remove', id),
  pauseAll: (): Promise<void> => ipcRenderer.invoke('queue:pauseAll'),
  resumeAll: (): Promise<void> => ipcRenderer.invoke('queue:resumeAll'),
  cancelAll: (): Promise<void> => ipcRenderer.invoke('queue:cancelAll'),
  retryAllFailed: (): Promise<void> => ipcRenderer.invoke('queue:retryAllFailed'),
  clearFinished: (): Promise<void> => ipcRenderer.invoke('queue:clearFinished'),
  onQueueUpdate: (cb: (jobs: Job[]) => void): (() => void) => {
    const handler = (_e: unknown, jobs: Job[]): void => cb(jobs)
    ipcRenderer.on('queue:update', handler)
    return () => ipcRenderer.removeListener('queue:update', handler)
  },

  /* Lich su */
  getHistory: (): Promise<HistoryRow[]> => ipcRenderer.invoke('history:list'),
  removeHistory: (id: string): Promise<void> => ipcRenderer.invoke('history:remove', id),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('history:clear'),

  /* Cai dat */
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:save', patch),
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:chooseFolder'),
  chooseFfmpeg: (): Promise<string | null> => ipcRenderer.invoke('settings:chooseFfmpeg'),
  chooseCookieFile: (): Promise<string | null> =>
    ipcRenderer.invoke('settings:chooseCookieFile'),
  openUrlFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openUrlFile'),

  /* He thong */
  openFolder: (path: string): Promise<void> => ipcRenderer.invoke('shell:openFolder', path),
  openFile: (path: string): Promise<string> => ipcRenderer.invoke('shell:openFile', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  /* Engine */
  getEngineStatus: (): Promise<BinaryStatus> => ipcRenderer.invoke('engine:status'),
  installYtdlp: (): Promise<BinaryStatus> => ipcRenderer.invoke('engine:installYtdlp'),
  updateYtdlp: (): Promise<BinaryStatus> => ipcRenderer.invoke('engine:updateYtdlp'),
  installFfmpeg: (): Promise<BinaryStatus> => ipcRenderer.invoke('engine:installFfmpeg'),
  openEngineFolder: (): Promise<void> => ipcRenderer.invoke('engine:openFolder'),
  resetEngine: (): Promise<BinaryStatus> => ipcRenderer.invoke('engine:reset'),
  onEngineProgress: (cb: (p: BinaryProgress) => void): (() => void) => {
    const handler = (_e: unknown, p: BinaryProgress): void => cb(p)
    ipcRenderer.on('engine:progress', handler)
    return () => ipcRenderer.removeListener('engine:progress', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
