import { useState } from 'react'
import { Captions, Image, Search } from 'lucide-react'
import type { QualityPreset, Settings } from '../../../shared/types'
import { parseUrls } from '../utils'

interface Props {
  settings: Settings
  engineReady: boolean
  onToast: (kind: 'ok' | 'err' | 'info', title: string, message?: string) => void
  onGoToQueue: () => void
}

/**
 * Cac tac vu phu dung chung duong ong tai da kiem chung, chi khac preset:
 * lay rieng phu de hoac anh bia ma khong tai video.
 */
export default function ToolsTab({
  settings,
  engineReady,
  onToast,
  onGoToQueue
}: Props): JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [langs, setLangs] = useState(settings.subLangs)

  const run = async (preset: QualityPreset, label: string): Promise<void> => {
    const urls = parseUrls(text)
    if (urls.length === 0) {
      onToast('err', 'Không tìm thấy link hợp lệ')
      return
    }
    setBusy(true)
    try {
      const results = await window.api.analyze(urls)
      const items = results.filter((r) => r.ok).flatMap((r) => r.items)
      if (items.length === 0) {
        onToast('err', 'Không đọc được link nào', results[0]?.error?.title)
        return
      }
      await window.api.download(
        items.map((m) => ({
          url: m.url,
          title: m.title,
          thumbnail: m.thumbnail,
          uploader: m.uploader,
          extractor: m.extractor,
          qualityLabel: label,
          options: {
            preset,
            container: settings.container,
            codecPreference: settings.codecPreference,
            audioFormat: settings.audioFormat,
            audioQuality: settings.audioQuality,
            writeSubs: preset === 'subtitles',
            autoSubs: settings.autoSubs,
            subLangs: langs,
            subFormat: settings.subFormat,
            embedSubs: false,
            embedThumbnail: false,
            embedMetadata: false
          }
        })),
        true
      )
      onToast('ok', `Đã thêm ${items.length} tác vụ`, label)
      setText('')
      onGoToQueue()
    } catch (e) {
      onToast('err', 'Không thực hiện được', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content-inner">
      <div className="section">
        <div className="section-head">
          <span className="section-title">Link nguồn</span>
          <div className="section-rule" />
        </div>
        <div className="url-zone">
          <textarea
            value={text}
            aria-label="Link nguồn cho công cụ"
            placeholder="Dán link video — mỗi link một dòng"
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Chỉ tải phụ đề</span>
          <div className="section-rule" />
        </div>
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Tải phụ đề ra file {settings.subFormat.toUpperCase()} riêng, không tải video. Bao gồm cả
          phụ đề tự động nếu bạn đã bật trong Cài đặt.
        </div>
        <div className="row">
          <div style={{ maxWidth: 200 }}>
            <input
              type="text"
              value={langs}
              aria-label="Ngôn ngữ phụ đề"
              placeholder="vi,en"
              onChange={(e) => setLangs(e.target.value)}
            />
          </div>
          <button disabled={busy || !engineReady} onClick={() => void run('subtitles', 'Phụ đề')}>
            {busy ? <span className="spin" /> : <Captions size={15} />} Tải phụ đề
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Chỉ tải ảnh bìa</span>
          <div className="section-rule" />
        </div>
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Lấy ảnh thumbnail độ phân giải cao nhất của video, không tải video.
        </div>
        <button disabled={busy || !engineReady} onClick={() => void run('thumbnail', 'Ảnh bìa')}>
          {busy ? <span className="spin" /> : <Image size={15} />} Tải ảnh bìa
        </button>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title">Kiểm tra nhanh</span>
          <div className="section-rule" />
        </div>
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Mở link đầu tiên trong trình duyệt để đối chiếu nội dung trước khi tải.
        </div>
        <button
          disabled={parseUrls(text).length === 0}
          onClick={() => void window.api.openExternal(parseUrls(text)[0])}
        >
          <Search size={15} /> Mở link đầu tiên
        </button>
      </div>
    </div>
  )
}
