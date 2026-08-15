import { useEffect, useState } from 'react'
import { Brush, Download, FolderOpen, History, PlayCircle, Trash2 } from 'lucide-react'
import type { HistoryRow } from '../../../preload/index'
import { formatBytes, formatDateTime, platformColor, platformName } from '../utils'

interface Props {
  onToast: (kind: 'ok' | 'err' | 'info', title: string, message?: string) => void
  onGoToQueue: () => void
}

export default function HistoryTab({ onToast, onGoToQueue }: Props): JSX.Element {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [query, setQuery] = useState('')

  const reload = (): void => {
    void window.api.getHistory().then(setRows)
  }
  useEffect(reload, [])

  const filtered = query.trim()
    ? rows.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    : rows

  const again = async (row: HistoryRow): Promise<void> => {
    await window.api.download(
      [
        {
          url: row.url,
          title: row.title,
          thumbnail: row.thumbnail,
          uploader: row.uploader,
          extractor: row.extractor,
          qualityLabel: row.qualityLabel,
          options: row.options
        }
      ],
      true
    )
    onToast('ok', 'Đã thêm vào hàng đợi', row.title)
    onGoToQueue()
  }

  if (rows.length === 0) {
    return (
      <div className="content-inner">
        <div className="empty">
          <History size={44} strokeWidth={1.2} className="empty-icon" />
          <div className="empty-title">Chưa có lịch sử tải</div>
          <div className="empty-sub">Video tải xong sẽ được ghi lại ở đây.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="content-inner">
      <div className="row" style={{ marginBottom: 16 }}>
        <div style={{ maxWidth: 300 }}>
          <input
            type="text"
            value={query}
            placeholder="Tìm theo tiêu đề..."
            aria-label="Tìm trong lịch sử"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="faint" style={{ fontSize: 12.5 }}>
          {filtered.length} / {rows.length} mục
        </span>
        <div className="spacer" />
        <button
          className="sm"
          onClick={async () => {
            await window.api.clearHistory()
            reload()
            onToast('info', 'Đã xóa lịch sử')
          }}
        >
          <Brush size={14} /> Xóa lịch sử
        </button>
      </div>

      {filtered.map((r) => (
        <div className={`hist ${r.exists ? '' : 'gone'}`} key={r.id}>
          {r.thumbnail ? (
            <img className="hist-thumb" src={r.thumbnail} alt="" />
          ) : (
            <div className="hist-thumb" />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="job-title" title={r.title}>
              {r.title}
            </div>
            <div className="job-meta">
              <span className="badge">
                <span className="dot" style={{ background: platformColor(r.extractor) }} />
                {platformName(r.extractor)}
              </span>
              <span className="badge">{r.qualityLabel}</span>
              <span>{formatBytes(r.fileSize)}</span>
              <span>{formatDateTime(r.downloadedAt)}</span>
              {!r.exists && <span style={{ color: 'var(--warn)' }}>File đã bị xóa</span>}
            </div>
          </div>

          <div className="job-actions">
            {r.exists && (
              <>
                <button
                  className="icon"
                  title="Phát file"
                  aria-label="Phát file"
                  onClick={() => void window.api.openFile(r.filePath)}
                >
                  <PlayCircle size={17} />
                </button>
                <button
                  className="icon"
                  title="Mở thư mục chứa"
                  aria-label="Mở thư mục chứa"
                  onClick={() => void window.api.openFolder(r.filePath)}
                >
                  <FolderOpen size={17} />
                </button>
              </>
            )}
            <button
              className="icon"
              title="Tải lại với cùng cấu hình"
              aria-label="Tải lại"
              onClick={() => void again(r)}
            >
              <Download size={16} />
            </button>
            <button
              className="icon danger"
              title="Xóa khỏi lịch sử"
              aria-label="Xóa khỏi lịch sử"
              onClick={async () => {
                await window.api.removeHistory(r.id)
                reload()
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
