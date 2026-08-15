# VidGrab

Ứng dụng desktop (Windows) tải video chất lượng cao từ mạng xã hội — giao diện đồ họa cho
[yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Tính năng

- **Chất lượng cao nhất thật sự.** Mặc định tải luồng video và audio tốt nhất riêng biệt rồi ghép
  bằng ffmpeg (`bv*+ba/b` với thứ tự ưu tiên `res,fps,hdr,br`). Đây là điểm khác biệt so với các
  web tải video thông thường vốn chỉ lấy được bản gộp sẵn tối đa 720p.
- **Chọn định dạng thủ công.** Bảng đầy đủ mọi luồng khả dụng: độ phân giải, FPS, codec, HDR, dung
  lượng, tách theo 3 nhóm (video / âm thanh / gộp sẵn).
- **Tải hàng loạt + hàng đợi.** Dán nhiều link cùng lúc, hoặc một link playlist/kênh sẽ tự mở ra
  thành từng video. Hàng đợi có tiến trình, tốc độ, ETA, hủy, thử lại.
- **Trích xuất MP3 / phụ đề.** Xuất MP3 320kbps hoặc M4A giữ nguyên gốc; tải phụ đề (kể cả phụ đề
  tự động) và nhúng thẳng vào video.
- Nhúng ảnh bìa + metadata, lấy cookie từ trình duyệt (cho video riêng tư / giới hạn tuổi), proxy,
  giới hạn tốc độ.

## Nền tảng hỗ trợ

| Nền tảng | Trạng thái |
|---|---|
| Windows 10/11 (x64) | ✅ Hỗ trợ — có bản cài đặt và bản portable |
| macOS / Linux | ⚠️ Về lý thuyết chạy được (Electron đa nền tảng) nhưng **chưa build và chưa kiểm thử**; đường dẫn binary hiện viết riêng cho Windows |
| Android / iOS | ❌ **Không hỗ trợ và không thể hỗ trợ bằng codebase này** — xem [Về bản điện thoại](#về-bản-điện-thoại) |

## Yêu cầu

Bản cài đặt **hoạt động ngoại tuyến hoàn toàn** — mọi thứ cần thiết đã đóng gói kèm.
Người dùng cuối không phải cài thêm gì, kể cả Python hay FFmpeg.

| Thành phần | Với người dùng cuối | Với người phát triển |
|---|---|---|
| yt-dlp | Đóng gói kèm | `resources/bin/yt-dlp.exe` |
| FFmpeg + FFprobe | Đóng gói kèm | `resources/bin/ffmpeg.exe`, `ffprobe.exe` |
| Node.js 18+ | Không cần | Bắt buộc để `npm run dev` / build |

Internet chỉ cần khi **tải video** (hiển nhiên) và khi bấm **cập nhật engine** trong Cài đặt.

## Chạy khi phát triển

```bash
npm install
npm run dev
```

## Đóng gói thành file cài đặt

```bash
npm run dist
```

Kết quả nằm trong `dist/`: một bản cài `.exe` (NSIS) và một bản portable chạy trực tiếp.

### Điều kiện để bản cài chạy được ngoại tuyến

`electron-builder.yml` đóng gói mọi file `.exe` trong `resources/bin/` vào thư mục `resources/bin`
của bản cài. Muốn bản cài tự chủ hoàn toàn, thư mục đó phải có đủ ba file **trước khi build**:

```
resources/bin/
├── yt-dlp.exe
├── ffmpeg.exe
└── ffprobe.exe
```

Thứ tự dò tìm lúc chạy (`src/main/binaries.ts`): đường dẫn tự chọn trong Cài đặt → **binary đóng gói
kèm** → binary đã tải về `%APPDATA%` → PATH hệ thống. Vì bản đóng gói kèm được ưu tiên trước PATH,
máy đích không cần cài FFmpeg và cũng không bị ảnh hưởng nếu máy đó có sẵn bản FFmpeg khác.

Nếu thiếu file nào, app vẫn chạy nhưng sẽ yêu cầu tải engine ở tab **Cài đặt → Engine** — lúc đó
cần internet.

## Về bản điện thoại

VidGrab **không thể cài lên Android hoặc iOS**, và đây không phải vấn đề đóng gói:

- Electron chỉ có runtime cho Windows, macOS và Linux. Không tồn tại bản Electron cho điện thoại,
  nên không có tùy chọn build nào tạo ra được APK hay IPA từ mã nguồn này.
- `yt-dlp.exe` và `ffmpeg.exe` là file thực thi Windows x64. Điện thoại dùng kiến trúc ARM và hệ
  điều hành khác nên không chạy được các file này.
- iOS còn chặn thêm ở tầng phân phối: cài ứng dụng ngoài App Store cần tài khoản nhà phát triển,
  và App Store không chấp nhận ứng dụng tải video.

Muốn có bản điện thoại thì phải viết một ứng dụng riêng — với Android là Kotlin cộng thư viện
`youtubedl-android`, chỉ dùng lại được ý tưởng giao diện chứ không dùng lại được mã nguồn này.

Phương án khả thi hơn nếu mục tiêu là *tải video rồi xem trên điện thoại*: thêm chế độ phục vụ giao
diện qua mạng LAN để điện thoại mở bằng trình duyệt và điều khiển VidGrab trên máy tính. Video vẫn
tải về máy tính, sau đó điện thoại lấy file qua LAN. Chế độ này **chưa được hiện thực**.

## Kiến trúc

```
src/
  main/          Electron main process (Node)
    binaries.ts  Dò tìm + tải yt-dlp/ffmpeg
    ytdlp.ts     Bọc yt-dlp: phân tích URL, dựng tham số, parse tiến trình
    queue.ts     Hàng đợi, giới hạn số job song song, hủy/thử lại
    settings.ts  Lưu cấu hình vào userData/settings.json
  preload/       Cầu IPC an toàn (contextIsolation bật, không có Node trong renderer)
  renderer/      Giao diện React
  shared/        Kiểu dữ liệu dùng chung
```

Tiến trình tải được đọc qua `--progress-template` của yt-dlp với tiền tố đánh dấu riêng, nên phân
tích được chính xác thay vì bóc tách chuỗi hiển thị.

## Lưu ý pháp lý

VidGrab chỉ là giao diện cho yt-dlp (giấy phép Unlicense). Chỉ tải nội dung bạn có quyền tải xuống
và tuân thủ điều khoản sử dụng của từng nền tảng.
