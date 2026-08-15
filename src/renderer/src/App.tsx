import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Download,
  History,
  ListChecks,
  Settings,
  Wrench
} from 'lucide-react'
import type { BinaryStatus, Job, Settings as AppSettings } from '../../shared/types'
import DownloadTab from './components/DownloadTab'
import HistoryTab from './components/HistoryTab'
import QueueTab from './components/QueueTab'
import SettingsTab, { type SectionKey } from './components/SettingsTab'
import Toasts, { type ToastItem } from './components/Toast'
import ToolsTab from './components/ToolsTab'

type Tab = 'download' | 'queue' | 'history' | 'tools' | 'settings'

const NAV: { key: Tab; label: string; icon: typeof Download; hint: string }[] = [
  { key: 'download', label: 'Tải video', icon: Download, hint: 'Ctrl+L' },
  { key: 'queue', label: 'Hàng đợi', icon: ListChecks, hint: 'Ctrl+J' },
  { key: 'history', label: 'Đã tải', icon: History, hint: '' },
  { key: 'tools', label: 'Công cụ', icon: Wrench, hint: '' },
  { key: 'settings', label: 'Cài đặt', icon: Settings, hint: 'Ctrl+,' }
]

const TITLES: Record<Tab, string> = {
  download: 'Tải video',
  queue: 'Hàng đợi',
  history: 'Đã tải',
  tools: 'Công cụ',
  settings: 'Cài đặt'
}

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('download')
  const [section, setSection] = useState<SectionKey>('general')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [binaries, setBinaries] = useState<BinaryStatus | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [version, setVersion] = useState('')
  const [width, setWidth] = useState(window.innerWidth)
  const [focusSignal, setFocusSignal] = useState(0)
  const prevJobs = useRef<Map<string, Job['status']>>(new Map())

  /* ----------------------------- Toast ----------------------------- */

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (item: Omit<ToastItem, 'id'>, ms = 5000) => {
      const id = `${Date.now()}-${Math.random()}`
      setToasts((prev) => [...prev.slice(-3), { ...item, id }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss]
  )

  const toast = useCallback(
    (kind: ToastItem['kind'], title: string, message?: string) =>
      pushToast({ kind, title, message }),
    [pushToast]
  )

  /* ----------------------------- Nap du lieu ----------------------------- */

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
    void window.api.getEngineStatus().then(setBinaries)
    void window.api.getQueue().then(setJobs)
    void window.api.getAppVersion().then(setVersion)
    return window.api.onQueueUpdate(setJobs)
  }, [])

  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* Bao khi mot job vua chuyen sang hoan tat hoac that bai. */
  useEffect(() => {
    const prev = prevJobs.current
    for (const j of jobs) {
      const before = prev.get(j.id)
      if (before && before !== j.status) {
        if (j.status === 'done') {
          pushToast(
            {
              kind: 'ok',
              title: 'Tải xong',
              message: j.outputFile?.split('\\').pop() ?? j.title,
              actions: j.outputFile
                ? [
                    { label: 'Mở file', run: () => void window.api.openFile(j.outputFile!) },
                    { label: 'Mở thư mục', run: () => void window.api.openFolder(j.outputFile!) }
                  ]
                : undefined
            },
            8000
          )
        } else if (j.status === 'error') {
          pushToast(
            {
              kind: 'err',
              title: j.error?.title ?? 'Tải thất bại',
              message: j.title,
              actions: [
                { label: 'Thử lại', run: () => void window.api.retry(j.id) },
                { label: 'Xem lỗi', run: () => setTab('queue') }
              ]
            },
            9000
          )
        }
      }
    }
    prevJobs.current = new Map(jobs.map((j) => [j.id, j.status]))
  }, [jobs, pushToast])

  /* ----------------------------- Phim tat ----------------------------- */

  const openSettings = useCallback((sec?: string) => {
    if (sec) setSection(sec as SectionKey)
    setTab('settings')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey) return
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setTab('queue')
      } else if (e.key === ',') {
        e.preventDefault()
        openSettings()
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setTab('download')
        setFocusSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSettings])

  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    // Cap nhat lac quan de o nhap khong bi giat, main process tra ve ban chuan.
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    void window.api.saveSettings(patch).then(setSettings)
  }, [])

  if (!settings) {
    return (
      <div className="empty" style={{ paddingTop: 220 }}>
        <span className="spin" />
      </div>
    )
  }

  const activeCount = jobs.filter((j) =>
    ['queued', 'preparing', 'running', 'processing'].includes(j.status)
  ).length
  const engineReady = Boolean(binaries?.ytdlp.ready)
  const shellClass = `app ${width < 1120 ? 'compact' : ''} ${width < 920 ? 'narrow' : ''}`

  return (
    <div className={shellClass}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ArrowDownToLine size={16} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <div className="brand-name">VidGrab</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.key}
                className={`nav-item ${tab === n.key ? 'active' : ''}`}
                aria-current={tab === n.key ? 'page' : undefined}
                title={n.hint ? `${n.label} (${n.hint})` : n.label}
                onClick={() => setTab(n.key)}
              >
                <Icon size={17} strokeWidth={2} />
                <span className="nav-label">{n.label}</span>
                {n.key === 'queue' && activeCount > 0 && (
                  <span className="nav-badge">{activeCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="engine-line" title={binaries?.ytdlp.path ?? 'Chưa cài yt-dlp'}>
            <span className={`dot ${binaries?.ytdlp.ready ? 'on' : 'off'}`} />
            <span className="engine-text">yt-dlp {binaries?.ytdlp.version ?? '—'}</span>
          </div>
          <div className="engine-line" title={binaries?.ffmpeg.path ?? 'Chưa có FFmpeg'}>
            <span className={`dot ${binaries?.ffmpeg.ready ? 'on' : 'off'}`} />
            <span className="engine-text">FFmpeg {binaries?.ffmpeg.version ?? '—'}</span>
          </div>
          <div className="engine-line engine-text" style={{ marginTop: 2 }}>
            VidGrab {version}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1>{TITLES[tab]}</h1>
          {tab === 'queue' && activeCount > 0 && (
            <span className="header-sub">{activeCount} đang hoạt động</span>
          )}
          <div className="spacer" />
          {!engineReady && (
            <button className="sm" onClick={() => openSettings('engine')}>
              <Wrench size={14} /> Cài đặt engine
            </button>
          )}
          {tab !== 'settings' && (
            <button
              className="icon"
              title="Cài đặt (Ctrl+,)"
              aria-label="Mở cài đặt"
              onClick={() => openSettings()}
            >
              <Settings size={17} />
            </button>
          )}
        </header>

        <div className="content" key={tab}>
          {tab === 'download' && (
            <DownloadTab
              settings={settings}
              engineReady={engineReady}
              focusSignal={focusSignal}
              onToast={toast}
              onGoToQueue={() => setTab('queue')}
              onOpenSettings={openSettings}
            />
          )}
          {tab === 'queue' && <QueueTab jobs={jobs} onOpenSettings={openSettings} />}
          {tab === 'history' && (
            <HistoryTab onToast={toast} onGoToQueue={() => setTab('queue')} />
          )}
          {tab === 'tools' && (
            <ToolsTab
              settings={settings}
              engineReady={engineReady}
              onToast={toast}
              onGoToQueue={() => setTab('queue')}
            />
          )}
          {tab === 'settings' && (
            <SettingsTab
              settings={settings}
              binaries={binaries}
              section={section}
              onSection={setSection}
              onSave={saveSettings}
              onBinariesChange={setBinaries}
              onToast={toast}
            />
          )}
        </div>
      </main>

      <Toasts items={toasts} onDismiss={dismiss} />
    </div>
  )
}
