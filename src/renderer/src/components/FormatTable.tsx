import { useMemo, useState } from 'react'
import type { FormatRow } from '../../../shared/types'
import { formatBytes, shortCodec } from '../utils'

interface Props {
  formats: FormatRow[]
  videoId: string | null
  audioId: string | null
  onPick: (kind: 'video' | 'audio', formatId: string | null) => void
}

type Tab = 'video' | 'audio' | 'combined'

/**
 * Bang chon dinh dang thu cong (che do Nang cao). Tach 3 nhom vi yt-dlp tra ve
 * lan lon: luong video roi (khong tieng), luong audio roi, va ban gop san.
 */
export default function FormatTable({ formats, videoId, audioId, onPick }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('video')

  const groups = useMemo(
    () => ({
      video: formats.filter((f) => f.hasVideo && !f.hasAudio),
      audio: formats.filter((f) => !f.hasVideo && f.hasAudio),
      combined: formats.filter((f) => f.hasVideo && f.hasAudio)
    }),
    [formats]
  )

  const rows = groups[tab]
  const isAudioTab = tab === 'audio'

  const pick = (f: FormatRow): void => {
    if (tab === 'combined') {
      // Ban gop san da co tieng, chon no thi bo luong audio rieng.
      onPick('video', videoId === f.formatId ? null : f.formatId)
      onPick('audio', null)
    } else if (tab === 'video') {
      onPick('video', videoId === f.formatId ? null : f.formatId)
    } else {
      onPick('audio', audioId === f.formatId ? null : f.formatId)
    }
  }

  const selectedId = isAudioTab ? audioId : videoId

  return (
    <div className="fmt-wrap">
      <div className="fmt-tabs" role="tablist">
        {(
          [
            ['video', 'Video', groups.video.length],
            ['audio', 'Âm thanh', groups.audio.length],
            ['combined', 'Gộp sẵn', groups.combined.length]
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`fmt-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <div className="fmt-scroll">
        {rows.length === 0 ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'var(--text-faint)' }}>
            Không có định dạng nào trong nhóm này.
          </div>
        ) : (
          <table className="fmt">
            <thead>
              <tr>
                <th style={{ width: 30 }} aria-label="Chọn" />
                <th>ID</th>
                <th>{isAudioTab ? 'Bitrate' : 'Độ phân giải'}</th>
                <th>{isAudioTab ? 'Codec' : 'FPS'}</th>
                <th>{isAudioTab ? 'Ext' : 'Codec'}</th>
                <th>Dung lượng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.formatId}
                  className={selectedId === f.formatId ? 'picked' : ''}
                  onClick={() => pick(f)}
                >
                  <td>
                    <input
                      type="radio"
                      readOnly
                      checked={selectedId === f.formatId}
                      aria-label={`Chọn định dạng ${f.formatId}`}
                      style={{ width: 'auto', accentColor: 'var(--accent)' }}
                    />
                  </td>
                  <td className="mono">{f.formatId}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {isAudioTab ? (f.tbr ? `${Math.round(f.tbr)} kbps` : '—') : f.resolution}
                  </td>
                  <td>{isAudioTab ? shortCodec(f.acodec) : f.fps ? `${Math.round(f.fps)}` : '—'}</td>
                  <td>{isAudioTab ? f.ext : shortCodec(f.vcodec)}</td>
                  <td>
                    {f.filesize ? `${f.filesizeApprox ? '~' : ''}${formatBytes(f.filesize)}` : '—'}
                  </td>
                  <td>
                    {[f.note, f.dynamicRange !== 'SDR' ? f.dynamicRange : null, f.ext]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
