# 🇫🇷 Français DELF Studio (A1 → DELF B1) — Bản v2

Ứng dụng web học và luyện thi tiếng Pháp toàn diện (A1 → DELF B1), chạy **100% ở phía client (Pure HTML5/CSS/Vanilla JS)**, không cần cài đặt backend hay build tool phức tạp.

---

## 🌟 Các tính năng nổi bật

### 1. 👥 Đa hồ sơ người học (Multi-User / Multi-Profile)
- Hỗ trợ **nhiều người học trên cùng một thiết bị/trình duyệt** (ví dụ: Bạn và bạn của bạn).
- Mỗi người học có:
  - Tên hiển thị và mục tiêu trình độ riêng (**A1 / A2 / B1**).
  - API Key riêng hoặc dùng chung Gateway.
  - Lịch sử hội thoại luyện nói, bài tập đọc/nghe và tiến độ điểm số hoàn toàn độc lập, không lẫn lộn dữ liệu.
- Nút chuyển đổi hồ sơ nhanh ở thanh Header kèm tính năng **Xuất / Nhập file sao lưu JSON**.

### 2. ⚡ Tích hợp AI Gateway OmniRoute & Đa nền tảng
- Kết nối mặc định với **OmniRoute** (`https://api.omniroute.io/v1`) chuẩn OpenAI-compatible.
- Hỗ trợ các model hàng đầu: `claude-3-7-sonnet`, `claude-3-5-sonnet`, `gpt-4o-mini`, v.v.
- Hỗ trợ gọi trực tiếp **Anthropic Messages API** hoặc **OpenAI API**.
- Tích hợp sẵn **Chế độ Demo (Mock Mode)** khi chưa nhập API key để bạn trải nghiệm ngay lập tức.

### 3. 📋 Phiếu chấm điểm Nói DELF B1 chuẩn chính thức (Grille d'évaluation FEI)
- Áp dụng chuẩn xác bảng chấm điểm 6 tiêu chí của **France Éducation International** (tổng **25 điểm**):
  1. *Entretien dirigé* (Phỏng vấn định hướng - tối đa 4 điểm)
  2. *Exercice en interaction* (Tương tác xử lý tình huống - tối đa 4 điểm)
  3. *Expression d'un point de vue* (Trình bày quan điểm cá nhân - tối đa 4 điểm)
  4. *Lexique* (Vốn từ vựng & độ chính xác - tối đa 5 điểm)
  5. *Morphosyntaxe* (Ngữ pháp & cấu trúc câu - tối đa 4 điểm)
  6. *Maîtrise du système phonologique* (Phát âm & ngữ điệu - tối đa 4 điểm)
- Đối với trình độ A1/A2: Tự động rút gọn theo 3 tiêu chí ngôn ngữ chuẩn (thang 15 điểm).
- Tổng hợp danh sách các lỗi ngữ pháp lặp lại để học viên khắc phục.

### 4. 🗣️ Luyện Nói tương tác (Expression Orale)
- **Web Speech API**: Nhận dạng giọng nói tiếng Pháp (`fr-FR`) trực tiếp từ Micro.
- Giáo viên AI phản hồi bằng tiếng Pháp tự nhiên, kèm phần **"💡 Nhận xét & Chữa lỗi"** bằng tiếng Việt.
- Tự động phát âm câu trả lời của giáo viên bằng giọng đọc chuẩn Pháp (Text-to-Speech) với nút nghe lại.

### 5. 📖 Luyện Đọc hiểu (Compréhension Écrite)
- Tự động sinh đoạn văn tiếng Pháp ngắn theo chuẩn chủ đề DELF.
- Kèm 3 câu hỏi trắc nghiệm A/B/C/D, tự động chấm điểm và giải thích chi tiết bằng tiếng Việt.

### 6. 🎧 Luyện Nghe âm điệu (Compréhension Orale - Audio First)
- Ẩn toàn bộ văn bản ban đầu, tập trung luyện tai nghe trước.
- Bộ điều khiển tốc độ đọc: **0.8x (Chậm)**, **1.0x (Chuẩn)**, **1.2x (Nhanh)**.
- Nút bật/tắt Transcript khi cần tra cứu và 3 câu hỏi trắc nghiệm kiểm tra độ hiểu.

### 7. 📚 Ngân hàng đề thật (Banque de sujets)
- Tích hợp sẵn các bài viết / transcript thực tế từ:
  - **RFI (Journal en français facile)**
  - **Apprendre TV5MONDE**
  - **France Éducation International (Đề mẫu DELF B1)**
- Cho phép bạn tự dán thêm transcript bài thi thật để AI sinh bài đọc/nghe bám sát thực tế nhất.

### 8. 📈 Báo cáo tiến độ & Biểu đồ
- Biểu đồ điểm thi Nói theo thời gian.
- Thống kê tần suất các lỗi ngữ pháp thường gặp.
- Bảng lịch sử các buổi luyện tập kèm chức năng xem lại phiếu điểm.

---

## 🚀 Hướng dẫn sử dụng

1. **Mở ứng dụng:**
   - Chỉ cần nhấp đúp mở file `index.html` trong trình duyệt Google Chrome, MS Edge hoặc Safari.
   - (Khuyên dùng) Mở qua Live Server hoặc localhost để tận dụng tối đa Web Speech API.

2. **Cấu hình API OmniRoute:**
   - Nhấn vào biểu tượng **⚙️ (Cài đặt)** ở góc trên bên phải.
   - Chọn nhà cung cấp: `OmniRoute (Khuyên dùng)`.
   - Endpoint Base URL: `https://api.omniroute.io/v1` (hoặc endpoint OmniRoute của bạn).
   - Nhập **API Key** của bạn và chọn Model (ví dụ: `claude-3-7-sonnet`).
   - Nhấn **Lưu Thay Đổi**.

3. **Tạo hồ sơ cho bạn bè:**
   - Nhấn vào nút **👤 [Tên học viên]** ở Header.
   - Nhập tên người học mới, chọn trình độ mục tiêu và nhập API key (nếu dùng key riêng).
   - Nhấn **Tạo hồ sơ và Bắt đầu học**.

---

## 📁 Cấu trúc mã nguồn

```
hoctiengphap/
├── index.html              # Giao diện chính Single Page Application
├── css/
│   └── style.css           # Design system, Dark/Light theme, DELF scorecard styling
├── js/
│   ├── config.js           # Cấu hình hệ thống, Grille DELF B1 / A1-A2, Authentic Seeds
│   ├── state.js            # Quản lý localStorage đa hồ sơ, phân lập dữ liệu, export/import
│   ├── speech.js           # Web Speech API (fr-FR Recognition & TTS Synthesis)
│   ├── ai-service.js       # Kết nối OmniRoute/OpenAI/Anthropic & Mock Fallback
│   ├── speaking.js         # Logic Luyện Nói & Chấm điểm Grille DELF B1
│   ├── reading.js          # Logic Luyện Đọc & MCQs
│   ├── listening.js        # Logic Luyện Nghe Audio-First & Speed Controls
│   ├── seed-bank.js        # Quản lý Ngân hàng đề thật (RFI / TV5MONDE)
│   ├── progress.js         # Thống kê, biểu đồ tiến độ & tổng hợp lỗi
│   └── app.js              # Controller khởi tạo và điều phối toàn bộ app
├── test/
│   └── verify.js           # Bộ test tự động kiểm thử logic hệ thống (100% Pass)
└── README.md
```
