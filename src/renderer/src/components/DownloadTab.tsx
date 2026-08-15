import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardPaste,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Film,
  ListPlus,
  ListVideo,
  Search,
  Settings2,
  Trash2,
  User
} from 'lucide-react'
import type {
  JobOptions,
  MediaInfo,
  ProbeResult,
  QualityOption,
  QualityPreset,
  Settings
} from '../../../shared/types'
import type { NewJobPayload } from '../../../preload/index'
import {
  buildQualityOptions,
  formatCount,
  formatDuration,
  formatUploadDate,
  maxResolutionLabel,
  parseUrls,
  platformColor,
  platformName
} from '../utils'
import { formatClock } from '../../../main/services/TimeRangeService'
import ErrorPanel from './ErrorPanel'
import FormatTable from './FormatTable'
import QualityPicker from './QualityPicker'
import TimeRangeSelector, { readRange } from './TimeRangeSelector'

/** Dung khi muc playlist chua co danh sach format de suy ra chi tiet. */
const GENERIC_OPTIONS: QualityOption[] = [
  { key: 'best', label: 'Chất lượng tốt nhất', detail: 'Độ phân giải cao nhất có sẵn' },
  { key: '2160', label: '4K', detail: 'Tối đa 2160p' },
  { key: '1440', label: '1440p', detail: 'Tối đa 1440p' },
  { key: '1080', label: '1080p', detail: 'Tối đa 1080p' },
  { key: '720', label: '720p', detail: 'Tối đa 720p' },
  { key: 'audio', label: 'Chỉ âm thanh', detail: 'Trích xuất theo cài đặt Âm thanh' }
].map((o) => ({
  ...o,
  height: null,
  fps: null,
  codec: null,
  hdr: false,
  hasAudio: true,
  estimatedSize: null,
  videoFormatId: null,
  audioFormatId: null,
  recommended: o.key === 'best',
  audioOnly: o.key === 'audio'
}))

interface Entry extends MediaInfo {
  key: string
  checked: boolean
  videoFormatId: string | null
  audioFormatId: string | null
}

interface Props {
  settings: Settings
  engineReady: boolean
  /** Dang do tim engine — chua biet ket qua nen chua duoc bao la thieu. */
  engineChecking: boolean
  focusSignal: number
  onToast: (kind: 'ok' | 'err' | 'info', title: string, message?: string) => void
  onGoToQueue: () => void
  onOpenSettings: (section?: string) => void
}

export default function DownloadTab({
  settings,
  engineReady,
  engineChecking,
  focusSignal,
  onToast,
  onGoToQueue,
  onOpenSettings
}: Props): JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failures, setFailures] = useState<ProbeResult[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [playlistName, setPlaylistName] = useState<string | null>(null)
  const [qualityKey, setQualityKey] = useState<string>('best')
  const [advanced, setAdvanced] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [writeSubs, setWriteSubs] = useState(settings.writeSubs)
  const [rangeOn, setRangeOn] = useState(false)
  const [startText, setStartText] = useState('00:00:00')
  const [endText, setEndText] = useState('')
  const [accurate, setAccurate] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const urls = useMemo(() => parseUrls(text), [text])
  const single = entries.length === 1 ? entries[0] : null
  const selected = entries.filter((e) => e.checked)

  useEffect(() => {
    if (focusSignal > 0) taRef.current?.focus()
  }, [focusSignal])

  /* --------------------------- Phan tich --------------------------- */

  const analyze = useCallback(async (): Promise<void> => {
    const list = parseUrls(text)
    if (list.length === 0) {
      onToast('err', 'Không tìm thấy link hợp lệ', 'Link phải bắt đầu bằng http:// hoặc https://')
      return
    }
    setBusy(true)
    setFailures([])
    try {
      const results = await window.api.analyze(list)
      setFailures(results.filter((r) => !r.ok))
      const ok = results.filter((r) => r.ok)
      const items: Entry[] = ok
        .flatMap((r) => r.items)
        .map((m, i) => ({
          ...m,
          key: `${m.url}#${i}`,
          checked: true,
          videoFormatId: null,
          audioFormatId: null
        }))
      setEntries(items)
      setPlaylistName(ok.find((r) => r.playlistCount > 0)?.items[0]?.playlistTitle ?? null)
      setQualityKey(settings.defaultPreset === 'custom' ? 'best' : settings.defaultPreset)
      setAdvanced(false)
      if (items.length === 0 && results.length > 0) {
        onToast('err', 'Không đọc được link nào', 'Xem chi tiết lỗi bên dưới.')
      }
    } catch (e) {
      onToast('err', 'Phân tích thất bại', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [text, onToast, settings.defaultPreset])

  /* --------------------------- Tai xuong --------------------------- */

  const options = useMemo<QualityOption[]>(() => {
    if (!single || single.formats.length === 0) return GENERIC_OPTIONS
    const built = buildQualityOptions(single.formats)
    return built.length > 0 ? built : GENERIC_OPTIONS
  }, [single])

  const activeOption = options.find((o) => o.key === qualityKey) ?? options[0]

  // Khoang thoi gian chi ap dung khi tai mot video: voi playlist, moi video co
  // thoi luong khac nhau nen ap dung chung mot khoang la sai (muc 89).
  const rangeResult = useMemo(
    () => readRange(startText, endText, accurate, single?.duration ?? null),
    [startText, endText, accurate, single]
  )
  const rangeActive = rangeOn && Boolean(single)

  const buildOptions = useCallback(
    (entry: Entry): JobOptions => {
      const custom = Boolean(entry.videoFormatId || entry.audioFormatId)
      return {
        timeRange: rangeActive ? rangeResult.range : null,
        preset: custom ? ('custom' as QualityPreset) : ((activeOption?.key ?? 'best') as QualityPreset),
        videoFormatId: entry.videoFormatId ?? undefined,
        audioFormatId: entry.audioFormatId ?? undefined,
        container: settings.container,
        codecPreference: settings.codecPreference,
        audioFormat: settings.audioFormat,
        audioQuality: settings.audioQuality,
        writeSubs,
        autoSubs: settings.autoSubs,
        subLangs: settings.subLangs,
        subFormat: settings.subFormat,
        embedSubs: settings.embedSubs,
        embedThumbnail: settings.embedThumbnail,
        embedMetadata: settings.embedMetadata
      }
    },
    [activeOption, settings, writeSubs, rangeActive, rangeResult]
  )

  const send = useCallback(
    async (startNow: boolean): Promise<void> => {
      if (selected.length === 0) return
      const payload: NewJobPayload[] = selected.map((e) => ({
        url: e.url,
        title: e.title,
        thumbnail: e.thumbnail,
        uploader: e.uploader,
        extractor: e.extractor,
        qualityLabel: e.videoFormatId
          ? `Tùy chọn ${e.videoFormatId}`
          : (activeOption?.label ?? 'Tốt nhất'),
        options: buildOptions(e)
      }))
      await window.api.download(payload, startNow)
      onToast(
        'ok',
        startNow ? `Bắt đầu tải ${payload.length} video` : `Đã thêm ${payload.length} vào hàng đợi`,
        payload.length === 1 ? payload[0].title : undefined
      )
      setEntries([])
      setText('')
      setFailures([])
      if (startNow) onGoToQueue()
    },
    [selected, activeOption, buildOptions, onToast, onGoToQueue]
  )

  /* --------------------------- Phim tat --------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && target === taRef.current) {
        e.preventDefault()
        void analyze()
        return
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (entries.length > 0) void send(true)
        else void analyze()
        return
      }
      // Ctrl+V ngoai o nhap: dan nhanh link tu clipboard vao o URL.
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V') && !typing) {
        void navigator.clipboard.readText().then((clip) => {
          if (clip.trim()) setText((prev) => (prev ? `${prev}\n${clip.trim()}` : clip.trim()))
          taRef.current?.focus()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analyze, send, entries.length])

  /* --------------------------- Keo tha --------------------------- */

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (dropped.trim()) {
      setText((prev) => (prev ? `${prev}\n${dropped.trim()}` : dropped.trim()))
      return
    }
    const file = e.dataTransfer.files[0]
    if (file && file.name.toLowerCase().endsWith('.txt')) {
      const content = await file.text()
      setText((prev) => (prev ? `${prev}\n${content}` : content))
    }
  }

  const patch = (key: string, changes: Partial<Entry>): void =>
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...changes } : e)))

  /* --------------------------- Giao dien --------------------------- */

  return (
    <div className="content-inner">
      {!engineReady && !engineChecking && (
        <div className="errbox warn" style={{ marginBottom: 20 }}>
          <div className="errbox-title">Chưa sẵn sàng</div>
          <div className="errbox-body">
            Engine yt-dlp chưa được cài đặt nên chưa thể phân tích link.
          </div>
          <div className="row" style={{ marginTop: 11 }}>
            <button className="sm" onClick={() => onOpenSettings('engine')}>
              <Settings2 size={14} /> Mở cài đặt Engine
            </button>
          </div>
        </div>
      )}

      <div
        className={`url-zone ${dragging ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => void onDrop(e)}
      >
        <textarea
          ref={taRef}
          value={text}
          aria-label="Danh sách link cần tải"
          placeholder={
            'Dán link video vào đây — mỗi link một dòng.\nKéo thả link hoặc file .txt cũng được.'
          }
          onChange={(e) => setText(e.target.value)}
        />
        <div className="url-bar">
          <button
            className="primary"
            onClick={() => void analyze()}
            disabled={busy || (!engineReady && !engineChecking) || urls.length === 0}
          >
            {busy ? <span className="spin" /> : <Search size={15} />}
            {busy ? 'Đang phân tích...' : 'Phân tích'}
          </button>
          <button
            className="ghost"
            title="Dán từ clipboard (Ctrl+V)"
            onClick={async () => {
              const clip = await navigator.clipboard.readText()
              if (clip.trim()) setText((p) => (p ? `${p}\n${clip.trim()}` : clip.trim()))
            }}
          >
            <ClipboardPaste size={15} /> Dán
          </button>
          <button
            className="ghost"
            title="Mở file .txt chứa danh sách link"
            onClick={async () => {
              const content = await window.api.openUrlFile()
              if (content) setText((p) => (p ? `${p}\n${content}` : content))
            }}
          >
            <FileText size={15} /> Từ file
          </button>
          {text && (
            <button className="icon" title="Xóa ô nhập" aria-label="Xóa ô nhập" onClick={() => setText('')}>
              <Trash2 size={15} />
            </button>
          )}
          <div className="spacer" />
          <span className="url-count">
            {urls.length > 0 ? `${urls.length} link` : <><span className="kbd">Enter</span> để phân tích</>}
          </span>
        </div>
      </div>

      {failures.map((f) => (
        <div key={f.sourceUrl} style={{ marginTop: 14 }}>
          <ErrorPanel
            error={f.error!}
            context={f.sourceUrl}
            onOpenCookieSettings={() => onOpenSettings('cookies')}
            onOpenEngineSettings={() => onOpenSettings('engine')}
            onRetry={() => void analyze()}
          />
        </div>
      ))}

      {entries.length > 0 && (
        <>
          {/* --- Xem truoc --- */}
          <div className="section" style={{ marginTop: 22 }}>
            {single ? (
              <PreviewCard entry={single} />
            ) : (
              <>
                <div className="section-head">
                  <ListVideo size={15} style={{ color: 'var(--accent)' }} />
                  <span className="section-title">
                    {playlistName ? `Playlist · ${entries.length} video` : `${entries.length} video`}
                  </span>
                  <div className="section-rule" />
                  <label className="check" style={{ padding: 0 }}>
                    <input
                      type="checkbox"
                      checked={selected.length === entries.length}
                      onChange={(e) =>
                        setEntries((p) => p.map((x) => ({ ...x, checked: e.target.checked })))
                      }
                    />
                    <span className="check-body" style={{ fontSize: 12.5 }}>
                      Chọn tất cả ({selected.length}/{entries.length})
                    </span>
                  </label>
                </div>
                {playlistName && (
                  <div className="faint" style={{ marginBottom: 10, fontSize: 12.5 }}>
                    {playlistName}
                  </div>
                )}
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {entries.map((e) => (
                    <div className="hist" key={e.key}>
                      <input
                        type="checkbox"
                        checked={e.checked}
                        aria-label={`Chọn ${e.title}`}
                        style={{ width: 'auto', accentColor: 'var(--accent)' }}
                        onChange={(ev) => patch(e.key, { checked: ev.target.checked })}
                      />
                      {e.thumbnail ? (
                        <img className="hist-thumb" src={e.thumbnail} alt="" />
                      ) : (
                        <div className="hist-thumb" />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="job-title">{e.title}</div>
                        <div className="job-meta">
                          {e.uploader && <span>{e.uploader}</span>}
                          {e.duration !== null && <span>{formatDuration(e.duration)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* --- Chat luong --- */}
          <div className="section">
            <div className="section-head">
              <span className="section-title">Chất lượng tải xuống</span>
              <div className="section-rule" />
              {single && single.formats.length > 0 && (
                <button className="ghost sm" onClick={() => setAdvanced(!advanced)}>
                  <Settings2 size={14} />
                  {advanced ? 'Ẩn nâng cao' : `Nâng cao (${single.formats.length} định dạng)`}
                </button>
              )}
            </div>

            <QualityPicker
              options={options}
              selectedKey={activeOption?.key ?? 'best'}
              onSelect={(o) => {
                setQualityKey(o.key)
                // Chon lai preset thi bo lua chon thu cong da dat truoc do.
                setEntries((p) => p.map((x) => ({ ...x, videoFormatId: null, audioFormatId: null })))
              }}
            />

            {advanced && single && (
              <div style={{ marginTop: 12 }}>
                <div className="field-hint" style={{ marginBottom: 8, marginTop: 0 }}>
                  Chọn trực tiếp luồng video và âm thanh. Lựa chọn ở đây sẽ thay thế preset bên trên.
                </div>
                <FormatTable
                  formats={single.formats}
                  videoId={single.videoFormatId}
                  audioId={single.audioFormatId}
                  onPick={(kind, id) =>
                    patch(single.key, kind === 'video' ? { videoFormatId: id } : { audioFormatId: id })
                  }
                />
              </div>
            )}

            {single && (
              <div style={{ marginTop: 18 }}>
                <div className="section-head">
                  <span className="section-title">Phạm vi tải</span>
                  <div className="section-rule" />
                </div>
                <TimeRangeSelector
                  duration={single.duration}
                  enabled={rangeOn}
                  startText={startText}
                  endText={endText}
                  accurate={accurate}
                  onToggle={(on) => {
                    setRangeOn(on)
                    // Lan dau bat: dat san moc ket thuc bang het video cho de sua.
                    if (on && !endText && single.duration !== null) {
                      setEndText(formatClock(single.duration))
                    }
                  }}
                  onChange={(patch) => {
                    if (patch.startText !== undefined) setStartText(patch.startText)
                    if (patch.endText !== undefined) setEndText(patch.endText)
                    if (patch.accurate !== undefined) setAccurate(patch.accurate)
                  }}
                />
              </div>
            )}

            <label className="check" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={writeSubs}
                onChange={(e) => setWriteSubs(e.target.checked)}
              />
              <span className="check-body">
                Tải phụ đề kèm theo
                <div className="check-sub">
                  Ngôn ngữ {settings.subLangs} · {settings.embedSubs ? 'nhúng vào video' : 'lưu file rời'} ·
                  đổi trong Cài đặt
                </div>
              </span>
            </label>
          </div>

          {/* --- Hanh dong --- */}
          <div className="row" style={{ paddingBottom: 8 }}>
            <button
              className="primary lg"
              onClick={() => void send(true)}
              disabled={selected.length === 0}
            >
              <Download size={16} />
              Tải xuống {activeOption?.label ?? ''}
              {selected.length > 1 ? ` · ${selected.length} video` : ''}
            </button>
            <button onClick={() => void send(false)} disabled={selected.length === 0}>
              <ListPlus size={15} /> Thêm vào hàng đợi
            </button>
            <div className="spacer" />
            <span className="faint" style={{ fontSize: 12 }}>
              <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span>
            </span>
          </div>
        </>
      )}

      {entries.length === 0 && failures.length === 0 && !busy && (
        <div className="empty">
          <Film size={44} strokeWidth={1.2} className="empty-icon" />
          <div className="empty-title">Chưa có video nào</div>
          <div className="empty-sub">
            Dán link vào ô phía trên rồi nhấn <span className="kbd">Enter</span> để bắt đầu.
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PreviewCard({ entry }: { entry: Entry }): JSX.Element {
  const platform = platformName(entry.extractor)
  const maxRes = maxResolutionLabel(entry.formats)
  const date = formatUploadDate(entry.uploadDate)
  const views = formatCount(entry.viewCount)

  return (
    <div className="preview">
      {entry.thumbnail ? (
        <img className="preview-thumb" src={entry.thumbnail} alt="" />
      ) : (
        <div className="preview-thumb ph">
          <Film size={28} strokeWidth={1.3} />
        </div>
      )}
      <div className="preview-body">
        <div className="preview-title" title={entry.title}>
          {entry.title}
        </div>

        <div className="meta-row" style={{ marginBottom: 10 }}>
          <span className="badge">
            <span className="dot" style={{ background: platformColor(entry.extractor) }} />
            {platform}
          </span>
          {maxRes && <span className="badge res">Tối đa {maxRes}</span>}
          {entry.uploader && (
            <span className="meta-item">
              <User size={13} /> {entry.uploader}
            </span>
          )}
          {entry.duration !== null && (
            <span className="meta-item">{formatDuration(entry.duration)}</span>
          )}
          {date && <span className="meta-item">{date}</span>}
          {views && (
            <span className="meta-item">
              <Eye size={13} /> {views}
            </span>
          )}
        </div>

        <div className="spacer" />
        <div className="row">
          <button
            className="ghost sm"
            onClick={() => void window.api.openExternal(entry.url)}
            title="Mở trang gốc trong trình duyệt"
          >
            <ExternalLink size={14} /> Mở trang gốc
          </button>
          {entry.subtitles.length > 0 && (
            <span className="badge">CC {entry.subtitles.slice(0, 3).join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
