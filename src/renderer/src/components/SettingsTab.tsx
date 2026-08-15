import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Captions,
  Cookie,
  Cpu,
  Download,
  FolderOpen,
  Music,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Video
} from 'lucide-react'
import type {
  AudioFormat,
  AudioQuality,
  BinaryProgress,
  BinaryStatus,
  BrowserName,
  CodecPreference,
  Container,
  QualityPreset,
  Settings,
  SubtitleFormat
} from '../../../shared/types'

export type SectionKey =
  | 'general'
  | 'download'
  | 'video'
  | 'audio'
  | 'subtitles'
  | 'cookies'
  | 'advanced'
  | 'engine'

const SECTIONS: { key: SectionKey; label: string; icon: typeof Cpu }[] = [
  { key: 'general', label: 'Chung', icon: SlidersHorizontal },
  { key: 'download', label: 'Tải xuống', icon: Download },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'audio', label: 'Âm thanh', icon: Music },
  { key: 'subtitles', label: 'Phụ đề', icon: Captions },
  { key: 'cookies', label: 'Cookie', icon: Cookie },
  { key: 'advanced', label: 'Nâng cao', icon: SlidersHorizontal },
  { key: 'engine', label: 'Engine', icon: Cpu }
]

interface Props {
  settings: Settings
  binaries: BinaryStatus | null
  section: SectionKey
  onSection: (s: SectionKey) => void
  onSave: (patch: Partial<Settings>) => void
  onBinariesChange: (b: BinaryStatus) => void
  onToast: (kind: 'ok' | 'err' | 'info', title: string, message?: string) => void
}

export default function SettingsTab(props: Props): JSX.Element {
  const { settings: s, section, onSection, onSave } = props

  return (
    <div className="content-inner">
      <div className="row wrap" style={{ marginBottom: 22, gap: 4 }}>
        {SECTIONS.map((sec) => {
          const Icon = sec.icon
          return (
            <button
              key={sec.key}
              className={section === sec.key ? 'primary sm' : 'ghost sm'}
              onClick={() => onSection(sec.key)}
            >
              <Icon size={14} /> {sec.label}
            </button>
          )
        })}
      </div>

      {section === 'general' && (
        <>
          <div className="field">
            <label className="field-label">Thư mục lưu video</label>
            <div className="row">
              <input type="text" value={s.outputDir} readOnly aria-label="Thư mục lưu video" />
              <button
                onClick={async () => {
                  const dir = await window.api.chooseFolder()
                  if (dir) onSave({ outputDir: dir })
                }}
              >
                Chọn...
              </button>
              <button
                className="icon"
                title="Mở thư mục"
                aria-label="Mở thư mục"
                onClick={() => void window.api.openFolder('')}
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>

          <Check
            checked={s.autoStartDownload}
            onChange={(v) => onSave({ autoStartDownload: v })}
            label="Tự động bắt đầu tải"
            sub="Tắt để mọi video chỉ nằm chờ trong hàng đợi cho tới khi bạn bấm tiếp tục."
          />
          <Check
            checked={s.minimizeToTray}
            onChange={(v) => onSave({ minimizeToTray: v })}
            label="Thu nhỏ xuống khay hệ thống"
            sub="Đóng cửa sổ sẽ ẩn app xuống khay thay vì thoát, giúp tải tiếp trong nền."
          />
          <Check
            checked={s.launchAtStartup}
            onChange={(v) => onSave({ launchAtStartup: v })}
            label="Khởi động cùng Windows"
          />
        </>
      )}

      {section === 'download' && (
        <>
          <div className="grid-2">
            <Num
              label="Số video tải song song"
              value={s.concurrency}
              min={1}
              max={8}
              hint="Nhiều hơn không phải lúc nào cũng nhanh hơn — một số nền tảng sẽ chặn tốc độ."
              onChange={(v) => onSave({ concurrency: v })}
            />
            <Num
              label="Số luồng cho mỗi video"
              value={s.fragmentConcurrency}
              min={1}
              max={16}
              hint="Tăng lên giúp tải nhanh hơn với video chia mảnh (HLS/DASH)."
              onChange={(v) => onSave({ fragmentConcurrency: v })}
            />
          </div>

          <div className="field">
            <label className="field-label">Mẫu tên file</label>
            <input
              type="text"
              value={s.filenameTemplate}
              onChange={(e) => onSave({ filenameTemplate: e.target.value })}
            />
            <div className="field-hint">
              Cú pháp output template của yt-dlp. Dấu <code>/</code> tạo thư mục con, ví dụ{' '}
              <code>%(uploader)s/%(title)s.%(ext)s</code>. Phần <code>.150B</code> giới hạn tiêu đề
              150 byte để tránh lỗi đường dẫn quá dài trên Windows.
            </div>
          </div>

          <div className="field" style={{ maxWidth: 320 }}>
            <label className="field-label">Giới hạn tốc độ</label>
            <input
              type="text"
              value={s.rateLimit}
              placeholder="Ví dụ: 5M — để trống là không giới hạn"
              onChange={(e) => onSave({ rateLimit: e.target.value })}
            />
          </div>
        </>
      )}

      {section === 'video' && (
        <>
          <div className="grid-2">
            <Select
              label="Chất lượng mặc định"
              value={s.defaultPreset}
              onChange={(v) => onSave({ defaultPreset: v as QualityPreset })}
              options={[
                ['best', 'Chất lượng tốt nhất'],
                ['2160', 'Tối đa 4K'],
                ['1440', 'Tối đa 1440p'],
                ['1080', 'Tối đa 1080p'],
                ['720', 'Tối đa 720p'],
                ['audio', 'Chỉ âm thanh']
              ]}
            />
            <Select
              label="Định dạng file"
              value={s.container}
              onChange={(v) => onSave({ container: v as Container })}
              options={[
                ['mp4', 'MP4 — tương thích rộng nhất'],
                ['mkv', 'MKV — chứa được mọi codec'],
                ['webm', 'WEBM — nhẹ, dùng VP9/AV1']
              ]}
            />
          </div>

          <div className="field" style={{ maxWidth: 380 }}>
            <label className="field-label">Ưu tiên codec</label>
            <select
              value={s.codecPreference}
              onChange={(e) => onSave({ codecPreference: e.target.value as CodecPreference })}
            >
              <option value="auto">Tự động — ưu tiên độ phân giải cao nhất</option>
              <option value="av1">AV1 — file nhỏ nhất, cần máy mới</option>
              <option value="vp9">VP9 — cân bằng</option>
              <option value="h264">H.264 — chạy được trên mọi thiết bị</option>
            </select>
            <div className="field-hint">
              Chế độ Tự động luôn lấy độ phân giải và FPS cao nhất bất kể codec. Chọn H.264 nếu
              video cần phát trên TV hoặc điện thoại đời cũ.
            </div>
          </div>
        </>
      )}

      {section === 'audio' && (
        <div className="grid-2">
          <Select
            label="Định dạng khi chỉ tải âm thanh"
            value={s.audioFormat}
            onChange={(v) => onSave({ audioFormat: v as AudioFormat })}
            options={[
              ['mp3', 'MP3 — phổ biến nhất'],
              ['m4a', 'M4A — giữ nguyên chất lượng gốc'],
              ['opus', 'Opus — nén tốt nhất'],
              ['wav', 'WAV — không nén']
            ]}
          />
          <Select
            label="Chất lượng âm thanh"
            value={s.audioQuality}
            onChange={(v) => onSave({ audioQuality: v as AudioQuality })}
            options={[
              ['best', 'Tốt nhất (VBR)'],
              ['320', '320 kbps'],
              ['256', '256 kbps'],
              ['192', '192 kbps']
            ]}
            hint="WAV không nén nên bỏ qua thiết lập này."
          />
        </div>
      )}

      {section === 'subtitles' && (
        <>
          <Check
            checked={s.writeSubs}
            onChange={(v) => onSave({ writeSubs: v })}
            label="Mặc định tải phụ đề"
          />
          <Check
            checked={s.autoSubs}
            onChange={(v) => onSave({ autoSubs: v })}
            label="Bao gồm phụ đề tự động"
            sub="Phụ đề do nền tảng tạo bằng nhận dạng giọng nói — có thể sai sót."
          />
          <Check
            checked={s.embedSubs}
            onChange={(v) => onSave({ embedSubs: v })}
            label="Nhúng phụ đề vào video"
            sub="Tắt để lưu phụ đề thành file riêng bên cạnh video."
          />
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="field">
              <label className="field-label">Ngôn ngữ ưu tiên</label>
              <input
                type="text"
                value={s.subLangs}
                placeholder="vi,en"
                onChange={(e) => onSave({ subLangs: e.target.value })}
              />
              <div className="field-hint">
                Cách nhau bằng dấu phẩy. Dùng <code>all</code> để lấy mọi ngôn ngữ.
              </div>
            </div>
            <Select
              label="Định dạng phụ đề"
              value={s.subFormat}
              onChange={(v) => onSave({ subFormat: v as SubtitleFormat })}
              options={[
                ['srt', 'SRT — tương thích rộng nhất'],
                ['vtt', 'VTT — dùng cho web']
              ]}
            />
          </div>
        </>
      )}

      {section === 'cookies' && (
        <>
          <div className="field" style={{ maxWidth: 380, opacity: s.cookieFile ? 0.5 : 1 }}>
            <label className="field-label">Lấy cookie từ trình duyệt</label>
            <select
              value={s.cookiesFromBrowser}
              disabled={Boolean(s.cookieFile)}
              onChange={(e) => onSave({ cookiesFromBrowser: e.target.value as BrowserName })}
            >
              <option value="">Tắt</option>
              <option value="firefox">Firefox — ổn định nhất</option>
              <option value="chrome">Chrome</option>
              <option value="edge">Edge</option>
              <option value="brave">Brave</option>
              <option value="chromium">Chromium</option>
              <option value="opera">Opera</option>
            </select>
            <div className="field-hint">
              Phải đóng hẳn trình duyệt trước khi tải, nếu không file cookie bị khóa. Chrome và Edge
              từ phiên bản 127 mã hóa cookie gắn với ứng dụng nên thường không đọc được —{' '}
              <b>Firefox là lựa chọn đáng tin nhất</b>.
            </div>
          </div>

          <div className="field" style={{ maxWidth: 560 }}>
            <label className="field-label">Hoặc dùng file cookies.txt</label>
            <div className="row">
              <input
                type="text"
                value={s.cookieFile}
                readOnly
                placeholder="Chưa chọn file"
                aria-label="Đường dẫn file cookies.txt"
              />
              <button
                onClick={async () => {
                  const f = await window.api.chooseCookieFile()
                  if (f) onSave({ cookieFile: f })
                }}
              >
                Chọn...
              </button>
              {s.cookieFile && (
                <button className="icon danger" title="Bỏ file cookie" aria-label="Bỏ file cookie" onClick={() => onSave({ cookieFile: '' })}>
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
            <div className="field-hint">
              Cách này bỏ qua được cả hai trở ngại trên: không đụng tới file đang bị trình duyệt
              khóa, cũng không dính mã hóa của Chrome. Dùng tiện ích mở rộng xuất cookie định dạng
              Netscape (ví dụ &ldquo;Get cookies.txt LOCALLY&rdquo;) khi đang đăng nhập trang đó, rồi chọn file ở
              đây. <b>Khi đã chọn file, tuỳ chọn trình duyệt phía trên sẽ bị bỏ qua.</b>
            </div>
          </div>

          <div className="errbox warn" style={{ marginTop: 6 }}>
            <div className="errbox-title">
              <AlertTriangle size={16} /> Về quyền truy cập
            </div>
            <div className="errbox-body">
              Cookie được dùng để truy cập đúng những nội dung mà tài khoản đang đăng nhập trên
              trình duyệt đó có quyền xem — ví dụ video riêng tư, giới hạn độ tuổi, hoặc trang yêu
              cầu đăng nhập như TikTok.
              <div style={{ marginTop: 6 }}>
                VidGrab <b>chỉ lưu tên trình duyệt hoặc đường dẫn file</b> bạn chọn — không bao giờ
                lưu nội dung cookie vào cấu hình, không ghi cookie ra log, và không gửi cookie đi
                đâu. yt-dlp đọc cookie trực tiếp tại thời điểm tải.
              </div>
              <div style={{ marginTop: 6 }}>
                Nếu gặp lỗi không đọc được cookie, hãy đóng hẳn trình duyệt rồi thử lại — trình
                duyệt đang chạy sẽ khóa file cookie.
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'advanced' && (
        <>
          <Check
            checked={s.embedThumbnail}
            onChange={(v) => onSave({ embedThumbnail: v })}
            label="Nhúng ảnh bìa vào file"
          />
          <Check
            checked={s.embedMetadata}
            onChange={(v) => onSave({ embedMetadata: v })}
            label="Ghi metadata (tiêu đề, tác giả, mô tả)"
          />

          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">Proxy</label>
            <input
              type="text"
              value={s.proxy}
              placeholder="socks5://127.0.0.1:1080 hoặc http://host:port"
              onChange={(e) => onSave({ proxy: e.target.value })}
            />
          </div>

          <CleanupBlock onToast={props.onToast} />

          <div className="field">
            <label className="field-label">Đường dẫn FFmpeg tùy chọn</label>
            <div className="row">
              <input
                type="text"
                value={s.ffmpegPath}
                placeholder="Để trống là tự động tìm"
                onChange={(e) => onSave({ ffmpegPath: e.target.value })}
              />
              <button
                onClick={async () => {
                  const file = await window.api.chooseFfmpeg()
                  if (file) {
                    onSave({ ffmpegPath: file })
                    props.onBinariesChange(await window.api.getEngineStatus())
                  }
                }}
              >
                Chọn...
              </button>
            </div>
          </div>
        </>
      )}

      {section === 'engine' && <EngineSection {...props} />}
    </div>
  )
}

/* ------------------------------ Engine ------------------------------ */

function EngineSection({ binaries, onBinariesChange, onToast }: Props): JSX.Element {
  const [progress, setProgress] = useState<BinaryProgress | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => window.api.onEngineProgress(setProgress), [])

  const task = async (name: string, fn: () => Promise<BinaryStatus>): Promise<void> => {
    setBusy(name)
    setProgress(null)
    try {
      onBinariesChange(await fn())
      onToast('ok', 'Hoàn tất', name)
    } catch {
      onToast('err', 'Thao tác thất bại', name)
    } finally {
      setBusy(null)
    }
  }

  const yt = binaries?.ytdlp
  const ff = binaries?.ffmpeg
  const fp = binaries?.ffprobe

  return (
    <>
      <div className="engine-card">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={`dot ${yt?.ready ? 'on' : 'off'}`} />
            <b>yt-dlp</b>
            <span className="faint" style={{ fontSize: 12.5 }}>
              {yt?.ready ? `phiên bản ${yt.version}` : 'chưa cài đặt'}
            </span>
            {yt?.bundled && <span className="badge">Kèm theo app</span>}
          </div>
          <div className="field-hint" style={{ wordBreak: 'break-all' }}>
            {yt?.path ?? 'Tải từ github.com/yt-dlp/yt-dlp — bản chính thức, khoảng 17 MB'}
          </div>
        </div>
        <button
          className={yt?.ready ? '' : 'primary'}
          disabled={busy !== null}
          onClick={() =>
            void task(
              yt?.ready ? 'Cập nhật yt-dlp' : 'Cài đặt yt-dlp',
              yt?.ready ? window.api.updateYtdlp : window.api.installYtdlp
            )
          }
        >
          {busy?.includes('yt-dlp') ? <span className="spin" /> : <RefreshCw size={15} />}
          {yt?.ready ? 'Kiểm tra cập nhật' : 'Cài đặt engine'}
        </button>
      </div>

      <div className="engine-card">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={`dot ${ff?.ready ? 'on' : 'off'}`} />
            <b>FFmpeg</b>
            <span className="faint" style={{ fontSize: 12.5 }}>
              {ff?.ready ? `phiên bản ${ff.version}` : 'không tìm thấy'}
            </span>
            {ff?.bundled && <span className="badge">Kèm theo app</span>}
          </div>
          <div className="field-hint" style={{ wordBreak: 'break-all' }}>
            {ff?.ready
              ? ff.path
              : 'Bắt buộc để ghép video chất lượng cao với âm thanh và xuất MP3.'}
          </div>
        </div>
        {!ff?.ready && (
          <button
            className="primary"
            disabled={busy !== null}
            onClick={() => void task('Cài đặt FFmpeg', window.api.installFfmpeg)}
          >
            {busy?.includes('FFmpeg') ? <span className="spin" /> : <Download size={15} />}
            Cài đặt FFmpeg
          </button>
        )}
      </div>

      <div className="engine-card">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={`dot ${fp?.ready ? 'on' : 'off'}`} />
            <b>FFprobe</b>
            <span className="faint" style={{ fontSize: 12.5 }}>
              {fp?.ready ? `phiên bản ${fp.version}` : 'không tìm thấy'}
            </span>
            {fp?.bundled && <span className="badge">Kèm theo app</span>}
          </div>
          <div className="field-hint" style={{ wordBreak: 'break-all' }}>
            {fp?.ready
              ? fp.path
              : 'Đi kèm FFmpeg. Thiếu FFprobe thì tính năng tải một đoạn video sẽ không dùng được.'}
          </div>
        </div>
      </div>

      {progress && (
        <div className={`errbox ${progress.stage === 'error' ? '' : 'warn'}`} style={{ marginTop: 16 }}>
          <div className="errbox-body" style={{ marginTop: 0 }}>
            {progress.message}
            {progress.stage === 'downloading' && (
              <div className="bar" style={{ marginTop: 9 }}>
                <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <button onClick={() => void window.api.openEngineFolder()}>
          <FolderOpen size={15} /> Mở thư mục engine
        </button>
        <button
          className="danger"
          disabled={busy !== null}
          onClick={() => void task('Đặt lại engine', window.api.resetEngine)}
        >
          <RotateCcw size={15} /> Đặt lại engine
        </button>
      </div>
      <div className="field-hint">
        Đặt lại sẽ xóa các engine đã tải về, buộc ứng dụng quay lại dùng bản đóng gói kèm hoặc bản
        cài trên hệ thống. Dùng khi engine bị hỏng.
      </div>
    </>
  )
}

/* ------------------------------ Don file rac ------------------------------ */

function formatMB(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function CleanupBlock({ onToast }: { onToast: Props['onToast'] }): JSX.Element {
  const [plan, setPlan] = useState<{ count: number; bytes: number; names: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const scan = async (): Promise<void> => {
    setBusy(true)
    try {
      setPlan(await window.api.previewTemp())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void scan()
  }, [])

  return (
    <div className="field" style={{ marginTop: 20 }}>
      <label className="field-label">Dọn file tạm</label>
      <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Các lần tải bị hủy hoặc lỗi để lại file dang dở và ảnh bìa rời trong thư mục lưu. VidGrab
        <b> không đụng tới</b> file của video đang tải hoặc đang tạm dừng, cũng không xóa video đã
        hoàn tất, phụ đề, hay file mới ghi trong 10 phút gần đây.
      </div>

      <div className="row">
        <button onClick={() => void scan()} disabled={busy}>
          {busy ? <span className="spin" /> : <RefreshCw size={15} />} Quét lại
        </button>
        <button
          className={plan && plan.count > 0 ? 'primary' : ''}
          disabled={busy || !plan || plan.count === 0}
          onClick={async () => {
            setBusy(true)
            try {
              const res = await window.api.cleanupTemp()
              onToast(
                'ok',
                `Đã dọn ${res.removed} file`,
                `Giải phóng ${formatMB(res.bytes)}${
                  res.failed.length > 0 ? ` · ${res.failed.length} file đang bị khóa` : ''
                }`
              )
              await scan()
            } finally {
              setBusy(false)
            }
          }}
        >
          <Trash2 size={15} />
          {plan && plan.count > 0 ? `Dọn ${plan.count} file · ${formatMB(plan.bytes)}` : 'Không có gì để dọn'}
        </button>
      </div>

      {plan && plan.count > 0 && (
        <div className="errbox-tech" style={{ marginTop: 10, maxHeight: 130 }}>
          {plan.names.slice(0, 12).join('\n')}
          {plan.names.length > 12 ? `\n… và ${plan.names.length - 12} file nữa` : ''}
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Controls ------------------------------ */

function Check({
  checked,
  onChange,
  label,
  sub
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}): JSX.Element {
  return (
    <label className="check" style={{ marginBottom: 10 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-body">
        {label}
        {sub && <div className="check-sub">{sub}</div>}
      </span>
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  hint
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  hint?: string
}): JSX.Element {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

function Num({
  label,
  value,
  min,
  max,
  hint,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  hint?: string
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
