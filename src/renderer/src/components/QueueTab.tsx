import { useState } from 'react'
import {
  Ban,
  Brush,
  CheckCircle2,
  FolderOpen,
  Inbox,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import type { Job } from '../../../shared/types'
import { formatBytes, formatEta, formatSpeed } from '../utils'
import ErrorPanel from './ErrorPanel'

const STATUS_LABEL: Record<Job['status'], string> = {
  queued: 'Đang chờ',
  preparing: 'Chuẩn bị',
  running: 'Đang tải',
  processing: 'Đang xử lý',
  paused: 'Tạm dừng',
  done: 'Hoàn tất',
  error: 'Thất bại',
  canceled: 'Đã hủy'
}

const ACTIVE: Job['status'][] = ['queued', 'preparing', 'running', 'processing']

interface Props {
  jobs: Job[]
  onOpenSettings: (section?: string) => void
}

export default function QueueTab({ jobs, onOpenSettings }: Props): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null)

  const active = jobs.filter((j) => j.status === 'running' || j.status === 'preparing').length
  const waiting = jobs.filter((j) => j.status === 'queued').length
  const paused = jobs.filter((j) => j.status === 'paused').length
  const done = jobs.filter((j) => j.status === 'done').length
  const failed = jobs.filter((j) => j.status === 'error').length
  const anyActive = jobs.some((j) => ACTIVE.includes(j.status))
  const finished = jobs.filter((j) => ['done', 'error', 'canceled'].includes(j.status)).length

  if (jobs.length === 0) {
    return (
      <div className="content-inner">
        <div className="empty">
          <Inbox size={44} strokeWidth={1.2} className="empty-icon" />
          <div className="empty-title">Hàng đợi trống</div>
          <div className="empty-sub">Các video bạn tải sẽ xuất hiện ở đây.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="content-inner">
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="stat-row">
          <span>
            <span className="stat-n">{jobs.length}</span> mục
          </span>
          <span>
            <span className="stat-n">{active}</span> đang tải
          </span>
          <span>
            <span className="stat-n">{waiting}</span> đang chờ
          </span>
          {paused > 0 && (
            <span>
              <span className="stat-n">{paused}</span> tạm dừng
            </span>
          )}
          {failed > 0 && (
            <span style={{ color: 'var(--err)' }}>
              <span className="stat-n" style={{ color: 'var(--err)' }}>
                {failed}
              </span>{' '}
              lỗi
            </span>
          )}
          {done > 0 && (
            <span style={{ color: 'var(--ok)' }}>
              <span className="stat-n" style={{ color: 'var(--ok)' }}>
                {done}
              </span>{' '}
              xong
            </span>
          )}
        </div>
        <div className="spacer" />
        {anyActive ? (
          <button className="sm" onClick={() => void window.api.pauseAll()}>
            <Pause size={14} /> Tạm dừng tất cả
          </button>
        ) : (
          <button className="sm" onClick={() => void window.api.resumeAll()} disabled={paused === 0}>
            <Play size={14} /> Tiếp tục tất cả
          </button>
        )}
        <button className="sm" onClick={() => void window.api.retryAllFailed()} disabled={failed === 0}>
          <RefreshCw size={14} /> Thử lại lỗi
        </button>
        <button className="sm" onClick={() => void window.api.cancelAll()} disabled={!anyActive}>
          <Ban size={14} /> Hủy tất cả
        </button>
        <button className="sm" onClick={() => void window.api.clearFinished()} disabled={finished === 0}>
          <Brush size={14} /> Dọn mục đã xong
        </button>
        <button className="icon" title="Mở thư mục lưu" aria-label="Mở thư mục lưu" onClick={() => void window.api.openFolder('')}>
          <FolderOpen size={16} />
        </button>
      </div>

      {jobs.map((j) => {
        const downloading = j.status === 'running'
        const busy = j.status === 'processing' || j.status === 'preparing'
        // HLS/DASH khong bao truoc tong dung luong -> khong tinh duoc %.
        const indeterminate = busy || (downloading && !j.totalBytes)
        return (
          <div key={j.id}>
            <div className="job">
              {j.thumbnail ? (
                <img className="job-thumb" src={j.thumbnail} alt="" />
              ) : (
                <div className="job-thumb" />
              )}

              <div className="job-body">
                <div className="job-title" title={j.title}>
                  {j.title}
                </div>

                <div className={`bar ${indeterminate ? 'indet' : ''}`}>
                  <div
                    className={`bar-fill ${j.status === 'done' ? 'done' : ''} ${
                      j.status === 'error' ? 'err' : ''
                    } ${j.status === 'paused' ? 'pause' : ''}`}
                    style={{
                      width:
                        j.status === 'done' ? '100%' : `${Math.max(indeterminate ? 100 : 1, j.percent)}%`
                    }}
                  />
                </div>

                <div className="job-meta">
                  <span className={`status ${j.status}`}>{STATUS_LABEL[j.status]}</span>
                  <span className="badge">{j.qualityLabel}</span>

                  {downloading && (
                    <>
                      {j.totalBytes ? <b>{j.percent.toFixed(0)}%</b> : null}
                      <span>
                        {formatBytes(j.downloadedBytes)}
                        {j.totalBytes ? ` / ${formatBytes(j.totalBytes)}` : ''}
                      </span>
                      <span>{formatSpeed(j.speed)}</span>
                      {j.eta !== null && <span>ETA {formatEta(j.eta)}</span>}
                    </>
                  )}

                  {busy && <span>{j.stage}</span>}

                  {j.status === 'paused' && j.downloadedBytes > 0 && (
                    <span>
                      Đã tải {formatBytes(j.downloadedBytes)} — sẽ tiếp tục từ đây
                    </span>
                  )}

                  {j.status === 'done' && (
                    <>
                      <span style={{ color: 'var(--ok)', display: 'flex', gap: 5, alignItems: 'center' }}>
                        <CheckCircle2 size={13} /> {formatBytes(j.fileSize)}
                      </span>
                      {j.outputFile && (
                        <span title={j.outputFile} className="faint">
                          {j.outputFile.split('\\').pop()}
                        </span>
                      )}
                    </>
                  )}

                  {j.status === 'error' && j.error && (
                    <button
                      className="link-btn"
                      onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                    >
                      {j.error.title} — xem cách khắc phục
                    </button>
                  )}
                </div>
              </div>

              <div className="job-actions">
                {j.status === 'done' && j.outputFile && (
                  <>
                    <button
                      className="icon"
                      title="Phát file"
                      aria-label="Phát file"
                      onClick={() => void window.api.openFile(j.outputFile!)}
                    >
                      <PlayCircle size={17} />
                    </button>
                    <button
                      className="icon"
                      title="Mở thư mục chứa"
                      aria-label="Mở thư mục chứa"
                      onClick={() => void window.api.openFolder(j.outputFile!)}
                    >
                      <FolderOpen size={17} />
                    </button>
                  </>
                )}

                {ACTIVE.includes(j.status) && (
                  <button
                    className="icon"
                    title="Tạm dừng"
                    aria-label="Tạm dừng"
                    onClick={() => void window.api.pause(j.id)}
                  >
                    <Pause size={17} />
                  </button>
                )}
                {j.status === 'paused' && (
                  <button
                    className="icon"
                    title="Tiếp tục"
                    aria-label="Tiếp tục"
                    onClick={() => void window.api.resume(j.id)}
                  >
                    <Play size={17} />
                  </button>
                )}
                {(j.status === 'error' || j.status === 'canceled') && (
                  <button
                    className="icon"
                    title="Thử lại"
                    aria-label="Thử lại"
                    onClick={() => void window.api.retry(j.id)}
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
                {ACTIVE.includes(j.status) && (
                  <button
                    className="icon danger"
                    title="Hủy"
                    aria-label="Hủy"
                    onClick={() => void window.api.cancel(j.id)}
                  >
                    <X size={17} />
                  </button>
                )}
                <button
                  className="icon danger"
                  title="Xóa khỏi danh sách"
                  aria-label="Xóa khỏi danh sách"
                  onClick={() => void window.api.removeJob(j.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {expanded === j.id && j.error && (
              <div style={{ padding: '0 4px 14px' }}>
                <ErrorPanel
                  error={j.error}
                  onOpenCookieSettings={() => onOpenSettings('cookies')}
                  onOpenEngineSettings={() => onOpenSettings('engine')}
                  onRetry={() => void window.api.retry(j.id)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
