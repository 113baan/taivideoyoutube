import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastItem {
  id: string
  kind: 'ok' | 'err' | 'info'
  title: string
  message?: string
  actions?: ToastAction[]
}

const ICONS = {
  ok: CheckCircle2,
  err: XCircle,
  info: Info
}

interface Props {
  items: ToastItem[]
  onDismiss: (id: string) => void
}

export default function Toasts({ items, onDismiss }: Props): JSX.Element {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div className={`toast ${t.kind}`} key={t.id}>
            <Icon size={17} className="toast-icon" aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{t.title}</div>
              {t.message && (
                <div className="toast-msg" title={t.message}>
                  {t.message}
                </div>
              )}
              {t.actions && t.actions.length > 0 && (
                <div className="toast-actions">
                  {t.actions.map((a) => (
                    <button
                      className="sm"
                      key={a.label}
                      onClick={() => {
                        a.run()
                        onDismiss(t.id)
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="icon"
              onClick={() => onDismiss(t.id)}
              aria-label="Đóng thông báo"
              title="Đóng"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
