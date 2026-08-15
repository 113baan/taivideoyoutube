import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Cookie, RefreshCw, Wrench } from 'lucide-react'
import type { FriendlyError } from '../../../shared/types'

interface Props {
  error: FriendlyError
  /** Nhan cho biet loi thuoc ve link nao khi phan tich nhieu link cung luc. */
  context?: string
  onOpenCookieSettings?: () => void
  onOpenEngineSettings?: () => void
  onRetry?: () => void
}

/**
 * Hien loi theo ngon ngu nguoi dung, stderr goc duoc giau sau muc
 * "Chi tiet ky thuat" cho ai can chan doan sau.
 */
export default function ErrorPanel({
  error,
  context,
  onOpenCookieSettings,
  onOpenEngineSettings,
  onRetry
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)

  const action = (() => {
    if (error.action === 'cookies' && onOpenCookieSettings) {
      return (
        <button className="sm" onClick={onOpenCookieSettings}>
          <Cookie size={14} /> Mở cài đặt Cookie
        </button>
      )
    }
    if (error.action === 'update-engine' && onOpenEngineSettings) {
      return (
        <button className="sm" onClick={onOpenEngineSettings}>
          <Wrench size={14} /> Mở cài đặt Engine
        </button>
      )
    }
    if (error.action === 'retry' && onRetry) {
      return (
        <button className="sm" onClick={onRetry}>
          <RefreshCw size={14} /> Thử lại
        </button>
      )
    }
    return null
  })()

  return (
    <div className="errbox">
      <div className="errbox-title">
        <AlertTriangle size={16} aria-hidden />
        {error.title}
      </div>
      <div className="errbox-body">
        {context && (
          <div className="mono faint" style={{ marginBottom: 5, wordBreak: 'break-all' }}>
            {context}
          </div>
        )}
        <div>{error.cause}</div>
        <div style={{ marginTop: 4 }}>
          <b style={{ color: 'var(--text-dim)' }}>Gợi ý:</b> {error.hint}
        </div>
      </div>

      <div className="row" style={{ marginTop: 11 }}>
        {action}
        <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Chi tiết kỹ thuật
        </button>
      </div>

      {open && <div className="errbox-tech">{error.technical}</div>}
    </div>
  )
}
