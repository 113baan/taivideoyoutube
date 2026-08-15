import { useMemo } from 'react'
import { AlertTriangle, Scissors } from 'lucide-react'
import type { TimeRange } from '../../../shared/types'
import {
  formatClock,
  parseClock,
  validateRange
} from '../../../main/services/TimeRangeService'

interface Props {
  /** Thoi luong video, null khi chua biet (muc playlist chua phan tich). */
  duration: number | null
  enabled: boolean
  startText: string
  endText: string
  accurate: boolean
  onToggle: (enabled: boolean) => void
  onChange: (patch: { startText?: string; endText?: string; accurate?: boolean }) => void
}

/**
 * Doc hai o nhap thanh khoang hop le, hoac tra ve loi de hien ngay canh o do.
 * Tach ra ngoai component de DownloadTab dung lai cung mot logic khi dung job.
 */
export function readRange(
  startText: string,
  endText: string,
  accurate: boolean,
  duration: number | null
): { range: TimeRange | null; error: string | null; field: 'start' | 'end' | null } {
  const start = parseClock(startText)
  const end = parseClock(endText)

  if (start === null) {
    return { range: null, error: 'Thời điểm bắt đầu không đọc được.', field: 'start' }
  }
  if (end === null) {
    return { range: null, error: 'Thời điểm kết thúc không đọc được.', field: 'end' }
  }

  const check = validateRange(start, end, duration)
  if (!check.ok) {
    return { range: null, error: check.message ?? 'Khoảng thời gian không hợp lệ.', field: check.field ?? null }
  }
  return { range: { start, end, accurate }, error: null, field: null }
}

export default function TimeRangeSelector({
  duration,
  enabled,
  startText,
  endText,
  accurate,
  onToggle,
  onChange
}: Props): JSX.Element {
  const result = useMemo(
    () => readRange(startText, endText, accurate, duration),
    [startText, endText, accurate, duration]
  )

  const range = result.range
  const clipLength = range && range.end !== null ? range.end - range.start : null
  // Ti le de ve thanh thoi gian; chi ve duoc khi biet thoi luong video.
  const pct = (v: number): number =>
    duration && duration > 0 ? Math.min(100, Math.max(0, (v / duration) * 100)) : 0

  return (
    <div>
      <div className="row" style={{ gap: 18, marginBottom: enabled ? 14 : 0 }}>
        <label className="check" style={{ padding: 0 }}>
          <input type="radio" checked={!enabled} onChange={() => onToggle(false)} />
          <span className="check-body">Toàn bộ video</span>
        </label>
        <label className="check" style={{ padding: 0 }}>
          <input type="radio" checked={enabled} onChange={() => onToggle(true)} />
          <span className="check-body">Chỉ một đoạn</span>
        </label>
        {duration !== null && (
          <span className="faint" style={{ fontSize: 12.5 }}>
            Video dài {formatClock(duration)}
          </span>
        )}
      </div>

      {enabled && (
        <>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 128 }}>
              <label className="field-label" htmlFor="tr-start">
                Từ
              </label>
              <input
                id="tr-start"
                type="text"
                value={startText}
                placeholder="00:01:00"
                aria-invalid={result.field === 'start'}
                style={result.field === 'start' ? { borderColor: 'var(--err)' } : undefined}
                onChange={(e) => onChange({ startText: e.target.value })}
              />
            </div>
            <div style={{ width: 128 }}>
              <label className="field-label" htmlFor="tr-end">
                Đến
              </label>
              <input
                id="tr-end"
                type="text"
                value={endText}
                placeholder="00:03:00"
                aria-invalid={result.field === 'end'}
                style={result.field === 'end' ? { borderColor: 'var(--err)' } : undefined}
                onChange={(e) => onChange({ endText: e.target.value })}
              />
            </div>

            {range && clipLength !== null && (
              <div style={{ paddingTop: 22 }}>
                <span className="badge res">
                  <Scissors size={12} /> {formatClock(range.start)} → {formatClock(range.end ?? 0)} ·
                  dài {formatClock(clipLength)}
                </span>
              </div>
            )}
          </div>

          <div className="field-hint" style={{ marginTop: 6 }}>
            Nhập kiểu nào cũng được: <code>90</code>, <code>1:30</code> hay <code>00:01:30</code>.
          </div>

          {result.error && (
            <div style={{ color: 'var(--err)', fontSize: 12.5, marginTop: 8 }} role="alert">
              {result.error}
            </div>
          )}

          {/* Thanh thoi gian truc quan — chi ve khi da biet thoi luong. */}
          {duration !== null && range && (
            <div style={{ marginTop: 14 }}>
              <div className="bar" style={{ height: 8, position: 'relative' }}>
                <div
                  className="bar-fill"
                  style={{
                    position: 'absolute',
                    left: `${pct(range.start)}%`,
                    width: `${Math.max(1, pct(range.end ?? 0) - pct(range.start))}%`
                  }}
                />
              </div>
              <div
                className="faint"
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 4 }}
              >
                <span>00:00:00</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>
          )}

          <label className="check" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={accurate}
              onChange={(e) => onChange({ accurate: e.target.checked })}
            />
            <span className="check-body">
              Ưu tiên cắt chính xác hơn
              <div className="check-sub">
                Mã hóa lại quanh điểm cắt nên chậm hơn đáng kể và chất lượng giảm nhẹ. Tắt thì cắt
                gần như tức thì nhưng điểm cắt bị kéo về khung hình gần nhất.
              </div>
            </span>
          </label>

          <div className="errbox warn" style={{ marginTop: 12 }}>
            <div className="errbox-title">
              <AlertTriangle size={15} /> Về độ chính xác và dung lượng
            </div>
            <div className="errbox-body">
              Điểm cắt phụ thuộc khung hình khóa của nguồn nên có thể lệch vài giây so với con số
              bạn nhập.
              <div style={{ marginTop: 5 }}>
                VidGrab cắt ngay trên máy chủ khi nền tảng cho phép — chỉ tải đúng đoạn cần. Nếu
                nền tảng từ chối (YouTube hiện đang như vậy), VidGrab <b>tự chuyển sang tải trọn
                video rồi cắt trên máy</b>, nghĩa là vẫn tốn băng thông cho cả video.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
