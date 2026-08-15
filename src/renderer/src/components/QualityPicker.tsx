import { Check, Music, Sparkles } from 'lucide-react'
import type { QualityOption } from '../../../shared/types'
import { formatBytes } from '../utils'

interface Props {
  options: QualityOption[]
  selectedKey: string
  onSelect: (option: QualityOption) => void
}

/**
 * Lop chon chat luong danh cho nguoi dung pho thong: vai the ro rang thay vi
 * bang 30+ dong. Bang chi tiet nam sau nut "Nang cao".
 */
export default function QualityPicker({ options, selectedKey, onSelect }: Props): JSX.Element {
  return (
    <div className="quality-grid" role="radiogroup" aria-label="Chọn chất lượng">
      {options.map((o) => {
        const on = o.key === selectedKey
        return (
          <button
            key={o.key}
            className={`q-card ${on ? 'on' : ''}`}
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(o)}
          >
            {on && <Check size={15} className="q-check" aria-hidden />}
            <div className="q-head">
              {o.audioOnly && <Music size={14} aria-hidden style={{ color: 'var(--text-dim)' }} />}
              <span className="q-label">{o.label}</span>
              {o.recommended && !on && (
                <span className="q-rec">
                  <Sparkles size={9} style={{ verticalAlign: -1 }} /> Đề xuất
                </span>
              )}
            </div>
            <div className="q-detail" title={o.detail}>
              {o.detail}
            </div>
            <div className="q-size">
              {o.estimatedSize ? `≈ ${formatBytes(o.estimatedSize)}` : 'Dung lượng chưa xác định'}
              {!o.audioOnly && ' · Video + Âm thanh'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
