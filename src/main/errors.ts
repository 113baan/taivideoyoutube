import type { FriendlyError } from '../shared/types'

interface Rule {
  match: RegExp
  title: string
  cause: string
  hint: string
  action: FriendlyError['action']
}

/**
 * Dich stderr cua yt-dlp sang thong bao nguoi dung hieu duoc.
 * Thu tu quan trong: quy tac cu the dat truoc quy tac chung.
 */
const RULES: Rule[] = [
  {
    match: /sign in to confirm|not a bot|confirm your age|age.?restricted|inappropriate for some users/i,
    title: 'Nền tảng yêu cầu xác thực',
    cause: 'Video này chỉ xem được khi đã đăng nhập, hoặc nền tảng đang nghi ngờ truy cập tự động.',
    hint: 'Bật "Cookie trình duyệt" trong Cài đặt và chọn trình duyệt bạn đang đăng nhập.',
    action: 'cookies'
  },
  {
    match: /private video|this video is private|login required|members[- ]only|requires? (a )?(paid )?(subscription|membership)/i,
    title: 'Nội dung riêng tư',
    cause: 'Video được đặt ở chế độ riêng tư hoặc chỉ dành cho thành viên.',
    hint: 'Nếu tài khoản của bạn có quyền xem, hãy bật "Cookie trình duyệt" trong Cài đặt.',
    action: 'cookies'
  },
  {
    // Chrome/Edge tu ban 127 ma hoa cookie bang app-bound encryption. Dong
    // trinh duyet KHONG giup gi — phai doi cach lay cookie.
    match: /failed to decrypt with dpapi|app-?bound|dpapi/i,
    title: 'Chrome khóa cookie bằng mã hóa mới',
    cause:
      'Từ Chrome/Edge phiên bản 127 trở đi, cookie được mã hóa gắn với ứng dụng nên yt-dlp không giải mã được. Đóng trình duyệt cũng không khắc phục được lỗi này.',
    hint: 'Hãy chọn một trình duyệt khác trong Cài đặt (Firefox hoạt động ổn định nhất), hoặc đăng nhập trang đó bằng Firefox rồi lấy cookie từ Firefox.',
    action: 'cookies'
  },
  {
    match: /could not copy .* cookie database|database is locked|unable to (open|read).*cookies|permission denied.*cookies/i,
    title: 'Không đọc được cookie trình duyệt',
    cause: 'Trình duyệt đang mở và khóa file cookie, nên yt-dlp không đọc được.',
    hint: 'Đóng hẳn trình duyệt (kể cả các tiến trình chạy nền trong khay hệ thống) rồi thử lại.',
    action: 'retry'
  },
  {
    match: /could not find .* cookies database|no such file.*cookies/i,
    title: 'Không tìm thấy dữ liệu cookie',
    cause: 'Trình duyệt bạn chọn trong Cài đặt chưa được cài, hoặc chưa từng có hồ sơ người dùng nào trên máy này.',
    hint: 'Chọn đúng trình duyệt bạn đang dùng trong Cài đặt > Cookie.',
    action: 'cookies'
  },
  {
    // Trang tra ve HTML khong chua du lieu video — thuong la tuong chan bot
    // hoac trang yeu cau dang nhap, chu khong phai extractor hong.
    match: /unexpected response from webpage request|unable to (find|extract) video data|failed to parse (json|webpage)/i,
    title: 'Nền tảng không trả về dữ liệu video',
    cause:
      'Trang web trả về một trang trống thay vì nội dung video. Điều này thường xảy ra khi nền tảng yêu cầu đăng nhập, hoặc đang chặn truy cập tự động từ máy bạn.',
    hint: 'Bật "Cookie trình duyệt" trong Cài đặt và chọn trình duyệt bạn đang đăng nhập trang đó. Nếu vẫn lỗi, thử cập nhật engine trong Cài đặt > Engine.',
    action: 'cookies'
  },
  {
    match: /video unavailable|removed by the uploader|no longer available|has been terminated|account.*(closed|suspended)/i,
    title: 'Video không còn tồn tại',
    cause: 'Video đã bị xóa, bị gỡ, hoặc tài khoản đăng đã bị khóa.',
    hint: 'Kiểm tra lại link bằng cách mở trang gốc.',
    action: 'none'
  },
  {
    match: /not available in your country|geo.?restricted|geo.?blocked|blocked it in your country/i,
    title: 'Bị chặn theo khu vực',
    cause: 'Nền tảng không cho phép truy cập video này từ vị trí hiện tại của bạn.',
    hint: 'Cấu hình Proxy trong Cài đặt > Nâng cao rồi thử lại.',
    action: 'none'
  },
  {
    match: /unsupported url|no video formats found|unable to extract|no suitable extractor/i,
    title: 'Không đọc được link này',
    cause: 'yt-dlp chưa hỗ trợ trang này, hoặc trang vừa thay đổi cấu trúc.',
    hint: 'Cập nhật engine trong Cài đặt > Engine — bản mới thường vá được ngay.',
    action: 'update-engine'
  },
  {
    match: /requested format is not available|format.*not available/i,
    title: 'Định dạng đã chọn không còn khả dụng',
    cause: 'Định dạng bạn chọn không còn được nền tảng cung cấp cho video này.',
    hint: 'Chọn lại chất lượng khác, hoặc dùng "Chất lượng tốt nhất".',
    action: 'retry'
  },
  {
    match: /ffmpeg|ffprobe.*not found|postprocessing/i,
    title: 'Lỗi khi xử lý video',
    cause: 'Bước ghép video + âm thanh bằng FFmpeg không hoàn tất.',
    hint: 'Kiểm tra FFmpeg trong Cài đặt > Engine đang ở trạng thái sẵn sàng.',
    action: 'none'
  },
  {
    match: /unable to download|connection reset|timed out|timeout|temporary failure|getaddrinfo|network is unreachable|connection aborted|ssl/i,
    title: 'Lỗi kết nối mạng',
    cause: 'Không kết nối được tới máy chủ của nền tảng.',
    hint: 'Kiểm tra mạng rồi bấm Thử lại. Nếu đang dùng proxy, kiểm tra lại cấu hình.',
    action: 'retry'
  },
  {
    match: /http error 429|too many requests|rate.?limit/i,
    title: 'Bị giới hạn tốc độ',
    cause: 'Nền tảng tạm chặn vì nhận quá nhiều yêu cầu từ máy bạn.',
    hint: 'Chờ vài phút, giảm "Số video tải song song" trong Cài đặt rồi thử lại.',
    action: 'retry'
  },
  {
    match: /no space left|not enough space|disk full/i,
    title: 'Ổ đĩa đã đầy',
    cause: 'Không còn đủ dung lượng trống ở thư mục lưu.',
    hint: 'Giải phóng dung lượng hoặc đổi thư mục lưu trong Cài đặt.',
    action: 'none'
  },
  {
    match: /filename too long|path.*too long|invalid argument/i,
    title: 'Đường dẫn file quá dài',
    cause: 'Windows giới hạn độ dài đường dẫn và tên video này vượt quá giới hạn đó.',
    hint: 'Rút ngắn "Mẫu tên file" trong Cài đặt, hoặc chọn thư mục lưu gần gốc ổ đĩa hơn.',
    action: 'none'
  }
]

/** Lay vai dong ERROR cuoi trong stderr — phan huu ich nhat de chan doan. */
function extractTechnical(raw: string): string {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim())
  const errorLines = lines.filter((l) => /error|warning/i.test(l))
  return (errorLines.length > 0 ? errorLines : lines).slice(-6).join('\n').trim()
}

export function classifyError(raw: string): FriendlyError {
  const technical = extractTechnical(raw) || raw.trim() || 'Không có thông tin chi tiết.'
  const rule = RULES.find((r) => r.match.test(raw))
  if (rule) {
    return {
      title: rule.title,
      cause: rule.cause,
      hint: rule.hint,
      action: rule.action,
      technical
    }
  }
  return {
    title: 'Không thể tải video',
    cause: 'Engine yt-dlp dừng lại với một lỗi không xác định.',
    hint: 'Xem "Chi tiết kỹ thuật" bên dưới, hoặc thử cập nhật engine trong Cài đặt.',
    action: 'update-engine',
    technical
  }
}

/** Loi khong den tu yt-dlp (vd thieu binary) van can bao bang cung mot cau truc. */
export function simpleError(title: string, cause: string, hint: string): FriendlyError {
  return { title, cause, hint, action: 'none', technical: `${title}: ${cause}` }
}
