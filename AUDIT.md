# VIDGRAB — AUDIT REPORT (Phase 0)

Ngày: 15/08/2026 · Phạm vi: toàn bộ `C:\PROJECT\vidgrab` · **Không có dòng code nào bị sửa trong phase này.**

Mọi kết luận dưới đây đều được kiểm chứng bằng lệnh chạy thực tế, không suy đoán. Chỗ nào chưa
kiểm chứng được đều ghi rõ.

---

## 0. Đính chính hai giả định trong đề bài

Trước khi vào báo cáo, hai điểm trong master prompt không khớp với thực tế codebase:

| Giả định trong đề bài | Thực tế đã kiểm chứng |
|---|---|
| Backend là Python (mục 56: "ưu tiên dùng Python API của yt-dlp") | **Không có Python.** `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `src-tauri/` đều không tồn tại. Backend là Electron main process viết bằng TypeScript, gọi `yt-dlp.exe` qua `spawn()`. Khuyến nghị dùng Python API **không áp dụng**; giữ subprocess. |
| "Không dùng thanh đỏ toàn màn hình như UI hiện tại" (mục 46) | Thanh đỏ đó **không do app vẽ**. Đó là title bar gốc của Windows đang lấy màu nhấn hệ thống của máy bạn. App hiện dùng `frame: true` (mặc định). Muốn bỏ phải chuyển sang frameless + tự vẽ window chrome — xem P6. |

---

## 1. Current architecture

Ba tiến trình theo đúng mô hình Electron chuẩn, cách ly nghiêm ngặt:

```
┌─────────────────── Renderer (Chromium 130, KHÔNG có Node) ───────────────────┐
│  React 18 + Vite   ·  App.tsx điều phối tab, toast, phím tắt                 │
│  Truy cập hệ thống DUY NHẤT qua window.api                                   │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ contextBridge (contextIsolation: true)
┌────────────────────────────────┴─────────────────────────────────────────────┐
│  Preload — src/preload/index.ts (81 dòng)                                    │
│  Expose đúng 34 hàm có kiểu. ipcRenderer KHÔNG bao giờ lộ ra renderer.        │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ ipcMain.handle
┌────────────────────────────────┴─────────────────────────────────────────────┐
│  Main process (Node 20.18.3)                                                 │
│    index.ts     236  cửa sổ, tray, 34 IPC handler, single-instance lock       │
│    ytdlp.ts     408  dựng tham số, parse tiến trình, phân tích metadata       │
│    queue.ts     284  hàng đợi, concurrency, pause/resume/cancel/retry         │
│    binaries.ts  300  dò tìm + tải yt-dlp/ffmpeg, engine manager               │
│    errors.ts    128  dịch stderr → thông báo người dùng (12 quy tắc)          │
│    settings.ts  109  cấu hình JSON                                            │
│    history.ts    67  lịch sử JSON                                             │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │ spawn(exe, args[])  — không qua shell
                        yt-dlp.exe  →  ffmpeg.exe
```

Tổng: **5.325 dòng** trong `src/`, 24 file. Không có file nào vượt 550 dòng.

## 2. Current tech stack

| Lớp | Công nghệ | Phiên bản (đã kiểm chứng) |
|---|---|---|
| Runtime | Electron | 33.4.11 (Node **20.18.3**, Chromium 130.0.6723.191) |
| Ngôn ngữ | TypeScript | 5.6.3 — `tsc --noEmit` sạch 0 lỗi |
| UI | React + Vite | 18.3.1 / 5.4.21 |
| Icon | lucide-react | 1.31.0 |
| Build | electron-vite + electron-builder | 2.3.0 / 25.1.8 |
| Engine | yt-dlp.exe | 2026.07.04 (bundle trong `resources/bin`) |
| Media | FFmpeg + ffprobe | 8.1 — **lấy từ PATH máy, KHÔNG bundle** |
| Lưu trữ | JSON phẳng trong `%APPDATA%\vidgrab` | không có DB |
| Test / Lint | **không có** | không có vitest/jest/eslint/prettier |

## 3. Existing features

**Đang hoạt động, đã kiểm chứng bằng download thật:**

- Phân tích URL qua yt-dlp, metadata + thumbnail thật
- Bộ chọn chất lượng thông minh (gom 33 format thô thành 6 thẻ) + bảng Nâng cao đầy đủ
- Tải chất lượng cao: luồng video + audio riêng, ghép bằng FFmpeg — đã xác minh ra file 3840×2160@60 VP9 + AAC 5.1
- Trích xuất âm thanh (MP3/M4A/Opus/WAV), phụ đề (tải + nhúng, SRT/VTT)
- Hàng đợi: concurrency, pause/resume/cancel/retry, thao tác hàng loạt
- Tiến trình thật qua `--progress-template` (phần trăm, byte, tốc độ, ETA)
- Lịch sử tải (JSON), tìm kiếm theo tiêu đề, tải lại, mở file/thư mục
- Dịch lỗi sang tiếng Việt có nguyên nhân + gợi ý + nút hành động, ẩn stderr sau "Chi tiết kỹ thuật"
- Toast, kéo–thả URL/`.txt`, phím tắt (Ctrl+L/J/,/Enter, Ctrl+Enter)
- Tray, khởi động cùng Windows, single-instance
- Engine manager: cài/cập nhật yt-dlp, cài FFmpeg, đặt lại engine
- Build NSIS installer + portable

**Bằng chứng còn trên đĩa:** `history.json` ghi nhận `Blender Conference 2025 Recap` — 61,8 MB, file thật tồn tại trong `Downloads\VidGrab`. Đọc bằng UTF-8 tường minh cho ra `Chất lượng tốt nhất` đúng dấu, không lỗi encoding.

## 4. Existing yt-dlp integration

`src/main/ytdlp.ts`. **Không dùng shell** — luôn `spawn(exe, argsArray)`.

Tách đúng hai pha như đề bài yêu cầu:

| Pha | Lệnh |
|---|---|
| Metadata | `-J --flat-playlist --` (playlist lấy phẳng cho nhanh) |
| Metadata 1 video | `-J --no-playlist --` |
| Tải | `-f <selector> -S <sort> -o <template> --newline --progress-template ... --` |

Preset → biểu thức `-f`/`-S` (`formatSelector()`, `sortExpression()`). **Không hard-code format ID** — đúng yêu cầu mục 9/57. Ví dụ `best` = `-f bv*+ba/b -S res,fps,hdr:12,br`.

Tiến trình đọc qua `--progress-template` với tiền tố `@@VG@@`, tách bằng `|`, không bóc chuỗi hiển thị.

**Đã kiểm chứng có sẵn trong yt-dlp 2026.07.04** (quy tắc #98 — không giả định option tồn tại):

`--download-sections` · `--force-keyframes-at-cuts` · `--split-chapters` · `--concurrent-fragments` · `--cookies-from-browser` · `--download-archive` · `--print-to-file` · `--progress-template` · `--limit-rate` · `--sponsorblock-remove` — **cả 10 đều OK.**

## 5. Existing FFmpeg integration

Gián tiếp: app chỉ truyền `--ffmpeg-location <path>` cho yt-dlp, còn lại yt-dlp tự gọi. App **không tự spawn ffmpeg**.

Thứ tự dò tìm (`resolveFfmpeg`): `settings.ffmpegPath` → `resources/bin` → `%APPDATA%\vidgrab\bin` → PATH hệ thống.

**Lỗ hổng:** `ffprobe` được `downloadFfmpeg()` copy về nhưng `getBinaryStatus()` **không kiểm tra và không báo cáo** ffprobe. Đề bài mục 17/40 yêu cầu kiểm tra ffprobe trước khi cho phép cắt đoạn — hiện chưa có.

## 6. Current download workflow

```
URL → probe() → MediaInfo[] → buildQualityOptions() → 6 thẻ chất lượng
  → JobOptions → enqueue() → pump() giữ trần concurrency
  → run() → startDownload() → spawn yt-dlp
  → stdout: @@VG@@... → onProgress → IPC (gộp 120ms) → UI
  → stdout: [Merger]/[ExtractAudio]/... → onStage
  → close(0) → statSync lấy dung lượng → addFromJob() ghi history
```

Đường dẫn file cuối được bắt bằng **regex trên stdout** (`[Merger] Merging formats into "..."`, `Destination:`, ...). Chạy đúng nhưng mong manh — xem P11.

## 7. Current UI architecture

`App.tsx` (259 dòng) là shell: state tab, settings, binaries, jobs, toasts + phím tắt toàn cục. Không có router, không state manager — chỉ `useState` + props. Với quy mô hiện tại là hợp lý.

5 tab: Tải video / Hàng đợi / Đã tải / Công cụ / Cài đặt. Settings chia 8 section.

Design token tập trung trong `:root` của `styles.css` (1.040 dòng) — không hard-code màu trong component. Responsive theo `.compact` (<1120px) và `.narrow` (<920px).

## 8. Current database

**Không có database.** Hai file JSON trong `%APPDATA%\vidgrab`:

| File | Cơ chế | Vấn đề |
|---|---|---|
| `settings.json` | ghi đè toàn bộ mỗi lần lưu | chưa tồn tại (chưa ai đổi cài đặt) |
| `history.json` | nạp hết vào RAM, cắt cứng ở 500 bản ghi | không index, tìm kiếm là substring phía client, mất bản ghi thứ 501 |

**Hàng đợi hoàn toàn trong RAM** (`const jobs: Job[] = []`). Đóng app là mất sạch.

## 9. Problems found

Xếp theo mức độ nghiêm trọng.

### Nghiêm trọng

| # | Vấn đề | Bằng chứng |
|---|---|---|
| **P1** | **Không có test và lint nào.** Đề bài bắt buộc test cho URL parser, time range, filename, queue, format selector. | không có `vitest.config.ts`/`jest`/`eslint`; `package.json` không có script `test`/`lint` |
| **P2** | **Hàng đợi không bền vững.** Đóng app mất toàn bộ hàng đợi; không có crash recovery (đề bài §73). | `queue.ts:22` — mảng in-memory, không ghi đĩa |
| **P3** | **File rác không được dọn.** Job bị giết để lại `.part` và thumbnail mồ côi vĩnh viễn. Không có TempManager (§72). | Đã tìm thấy thật: `...Showcase Reel [gqfLYIJMv7I].f137.mp4.part` **19,6 MB** + 2 file `.webp` mồ côi |
| **P4** | **Chưa có tính năng cắt đoạn thời gian** — tính năng CORE của phase này. | không có `--download-sections` ở bất kỳ đâu trong `ytdlp.ts` |
| **P5** | **FFmpeg không được bundle.** Installer chạy trên máy bạn vì máy có sẵn FFmpeg; máy sạch sẽ hỏng chức năng ghép. | `resources/bin` chỉ có `yt-dlp.exe` (17,4 MB) |

### Trung bình

| # | Vấn đề | Chi tiết |
|---|---|---|
| **P6** | Window dùng title bar hệ thống → ăn màu nhấn Windows (đỏ trên máy này). Cần frameless + chrome tự vẽ để "đồng bộ theme" (§46). | `index.ts` `BrowserWindow` không đặt `frame`/`titleBarStyle` |
| **P7** | Không có i18n — chuỗi tiếng Việt hard-code khắp component (§65). | mọi file `.tsx` |
| **P8** | Không có logging có cấu trúc, không có Diagnostics Center (§40, §41). | chỉ `console.error` rải rác |
| **P9** | Danh sách playlist **không virtualize** — channel 500 video sẽ render 500 DOM node (§20, §71). | `DownloadTab.tsx` map thẳng trong div `maxHeight:260` |
| **P10** | Không phát hiện trùng lặp, không dùng `--download-archive` (§31, §74). | — |
| **P11** | Đường dẫn file cuối bắt bằng regex stdout — mong manh khi yt-dlp đổi chuỗi log. `--print-to-file after_move:filepath` đã xác minh có sẵn và bền hơn. | `ytdlp.ts` khối `handleLine` |
| **P12** | Không có preset và favorites (§33, §34). | — |
| **P13** | `getBinaryStatus()` không báo cáo ffprobe — cần cho gating tính năng cắt (§17). | `binaries.ts` |

### Nhẹ

| # | Vấn đề |
|---|---|
| **P14** | Concurrency mặc định 2, đề bài muốn 3 (§26) |
| **P15** | Thiếu FLAC trong định dạng audio (§11) |
| **P16** | Chưa hỗ trợ chapters (§19) |
| **P17** | Chưa có auto-clipboard detection (§6) |
| **P18** | Chưa có phân loại thư mục theo nền tảng (§29) |
| **P19** | Token màu lệch nhẹ so với spec (`#0d0f13`/`#5B8CFF` so với `#0B0D12`/`#6C63FF`) |
| **P20** | `retry()` reset `downloadedBytes` về 0 nhưng `.part` vẫn còn → yt-dlp resume thật, UI lại đếm lại từ đầu |

### Đã kiểm tra và KHÔNG phải lỗi

- **Encoding UTF-8**: nghi ngờ mojibake trong `history.json` là **sai** — đọc bằng UTF-8 tường minh cho ra dấu tiếng Việt đúng. Lỗi nằm ở PowerShell 5.1 khi tôi đọc file, không ở app.
- **Bảo mật lệnh**: không có chỗ nào nối chuỗi shell. `spawn(exe, args[])` toàn bộ, `shell` không bao giờ bật, có `assertHttpUrl()` chặn argument injection và `--` ngăn URL bị hiểu thành option.

## 10. Recommended architecture

Giữ nguyên khung 3 tiến trình. Bổ sung lớp service trong main process:

```
main/
  services/
    MetadataService    tách từ ytdlp.ts — probe, platform, chapters
    FormatService      tách từ ytdlp.ts — preset → selector
    TimeRangeService   MỚI — parse/validate/normalize, sinh --download-sections
    FilenameService    MỚI — template, sanitize Windows, chèn khoảng thời gian
    DownloadService    tách từ ytdlp.ts — dựng args, spawn, parse
    QueueService       queue.ts + persistence
    HistoryService     history.ts → SQLite
    PresetService      MỚI
    DiagnosticsService MỚI — yt-dlp/ffmpeg/ffprobe/network/disk
    TempManager        MỚI — dọn .part, .webp mồ côi
    Logger             MỚI — có cấu trúc, xoay vòng, lọc cookie
  db/
    index.ts + migrations/
```

### Quyết định database — cần bạn chốt

`node:sqlite` **không dùng được**: đã probe trong runtime Electron thật, Node 20.18.3 trả về `ERR_UNKNOWN_BUILTIN_MODULE`.

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. `better-sqlite3`** | Đúng yêu cầu §54, index, query thật, an toàn ghi | Native module → cần `electron-rebuild`, tăng rủi ro build, phải rebuild mỗi lần nâng Electron |
| **B. Nâng Electron lên ≥ 37** (Node 22+) rồi dùng `node:sqlite` | Không native module | Nhảy 4+ major, rủi ro hồi quy toàn app |
| **C. Giữ JSON, thêm index trong RAM** | Không rủi ro build | Không đạt §54; kém khi lịch sử lớn |

**Tôi đề xuất A** — `electron-builder` đã tự chạy `@electron/rebuild` (thấy trong log build: *"installing native dependencies"*), nên chi phí thực tế thấp hơn vẻ ngoài.

## 11. Files to modify

| File | Thay đổi |
|---|---|
| `src/shared/types.ts` | thêm `TimeRange`, `Chapter`, `Preset`, `DiagnosticsReport`; mở rộng `JobOptions`, `Settings` |
| `src/main/ytdlp.ts` | tách thành services; thêm `--download-sections`, `--force-keyframes-at-cuts`, chapters; đổi bắt đường dẫn sang `--print-to-file` |
| `src/main/queue.ts` | persistence + crash recovery; retry phân biệt lỗi tạm thời / vĩnh viễn; concurrency mặc định 3 |
| `src/main/history.ts` | chuyển sang SQLite, **migrate `history.json` không mất dữ liệu** |
| `src/main/binaries.ts` | báo cáo ffprobe; kênh yt-dlp stable/nightly/master |
| `src/main/index.ts` | frameless window + IPC điều khiển cửa sổ; IPC cho preset/diagnostics/time-range |
| `src/main/settings.ts` | mục cài đặt mới |
| `src/preload/index.ts` | mở rộng API (giữ nguyên nguyên tắc tối thiểu) |
| `src/renderer/src/components/DownloadTab.tsx` | thêm TimeRangeSelector, chapters, preset; virtualize playlist |
| `src/renderer/src/components/QueueTab.tsx` | tab con Đang tải/Chờ/Xong/Lỗi, search, filter |
| `src/renderer/src/components/SettingsTab.tsx` | mục Diagnostics, Presets, Logs, Language |
| `src/renderer/src/styles.css` | đồng bộ token theo spec §44; style title bar |
| `package.json` | thêm `test`, `lint`; `better-sqlite3`, `vitest`, `eslint` |
| `electron-builder.yml` | bundle `ffmpeg.exe`/`ffprobe.exe`; cấu hình native module |
| `README.md` | bổ sung mục §83 |

## 12. Files to create

`main/services/*` (10 file nêu ở mục 10) · `main/db/index.ts` + migrations · `renderer/components/TimeRangeSelector.tsx`, `TimelineScrubber.tsx`, `ChapterList.tsx`, `PresetPicker.tsx`, `DiagnosticsPanel.tsx`, `TitleBar.tsx`, `VirtualList.tsx` · `renderer/i18n/{vi,en}.ts` · `tests/*.test.ts` · `ARCHITECTURE.md` · `CHANGELOG.md`

## 13. Implementation phases

| Phase | Nội dung | Rủi ro với pipeline hiện tại |
|---|---|---|
| **1** | Nền backend: tách services, TimeRangeService + FilenameService **kèm unit test trước**, DiagnosticsService, TempManager, Logger | Thấp — thêm mới, không đổi luồng cũ |
| **2** | SQLite + migration từ JSON, queue persistence, crash recovery | **Trung bình** — phải giữ nguyên `history.json` cũ |
| **3** | UI: title bar frameless, token theo spec, TimeRangeSelector + timeline | Thấp |
| **4** | Download Center: tab con, search/filter, retry phân loại lỗi | Trung bình — đụng `queue.ts` |
| **5** | History/Preset/Favorites | Thấp |
| **6** | Cookies UX, proxy test, chapters, duplicate detection, auto-clipboard, i18n | Trung bình |
| **7** | Test đầy đủ + build + ma trận test thực tế | — |

Sau mỗi phase: `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` → chạy thật 1 download hồi quy.

## 14. Risks

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| **R1** | Tách `ytdlp.ts` làm sai bộ tham số đã kiểm chứng → hỏng tính năng lõi | Viết **golden test** chốt cứng mảng args cho từng preset **trước** khi tách |
| **R2** | `--download-sections` đổi ngữ nghĩa tiến trình: yt-dlp chuyển sang tải qua ffmpeg, `total_bytes` có thể không còn → thanh tiến trình thành vô định | Phải **đo thực nghiệm** ở đầu Phase 1 rồi mới thiết kế UI tiến trình |
| **R3** | `--download-sections` + `--concurrent-fragments` có thể xung đột | Thử nghiệm; nếu xung đột thì ép fragment = 1 khi cắt đoạn |
| **R4** | Migrate SQLite làm mất lịch sử | Sao lưu `history.json` → `history.json.bak` trước; migration idempotent |
| **R5** | `better-sqlite3` làm hỏng build đóng gói | Dựng installer ngay khi thêm dependency, không để đến Phase 7 |
| **R6** | Frameless window mất snap/maximize/kéo cửa sổ gốc | Dùng `-webkit-app-region: drag`; test snap Win+mũi tên |
| **R7** | Cắt đoạn phụ thuộc keyframe → file lệch vài giây so với người dùng nhập | **Không hứa cắt chính xác từng frame** (§16); nêu rõ trong UI; `--force-keyframes-at-cuts` là tùy chọn có cảnh báo chậm |
| **R8** | Nâng Electron (phương án B) gây hồi quy diện rộng | Không nâng trong phase này |

## 15. Testing strategy

**Unit (vitest, chạy trong Node — không cần Electron):**
- `TimeRangeService`: `1:00`/`01:00`/`00:01:00` → `00:01:00`; `end <= duration`; `end > start`; input rác; video ngắn hơn `end`
- `FilenameService`: ký tự cấm Windows `: * ? " < > | / \`; đường dẫn dài; chèn `[01m00s-03m00s]`
- `FormatService`: **golden test** — preset → mảng args chính xác (chốt cứng pipeline hiện tại)
- `errors.ts`: từng quy tắc trong 12 quy tắc → đúng `action`
- `buildQualityOptions()`: fixture JSON thật của yt-dlp → số thẻ và nhãn đúng

**Integration:** queue concurrency (đã từng có lỗi này — 3 job/trần 2 phải cho 2 chạy + 1 chờ), pause→resume tiếp tục từ `.part`, migration SQLite giữ nguyên số bản ghi.

**Ma trận thực tế** (chỉ nội dung công khai): YouTube video/Shorts/playlist, TikTok, Instagram, Facebook, X, Vimeo, Reddit — ghi lại extractor, metadata, thumbnail, formats, download, FFmpeg, file cuối.

**Test lỗi:** URL sai · URL không hỗ trợ · video đã xóa · video riêng tư · cần đăng nhập · timeout · thiếu FFmpeg · đầy đĩa · thư mục không ghi được · trùng file · `.part` hỏng.

**Đã có sẵn để hồi quy:** file `.part` 19,6 MB đang tồn tại là fixture sẵn cho test resume và test dọn rác.

---

## Trạng thái kết thúc Phase 0

`typecheck` sạch · `build` chạy được · installer + portable dựng được · download thật đã kiểm chứng tới file 4K60 có tiếng.
**Chưa sửa dòng code nào.** Chờ xác nhận phương án database trước khi vào Phase 1.
