# Baro House — Dự án vận hành

MVP demo quản lý vận hành Baro House (SPA HTML/CSS/JS thuần).
Hierarchy theo Google Sheet Test app: **Baro House › Khu vực › Tòa nhà**.

## Chạy nhanh
Mở `index.html` hoặc publish static (here.now). Không cần build/backend.

## Điều hướng (schema v3)
### Level 1 — Baro House
- Nút khu vực **KV1**, **KV2** (+ tạo khu vực)
- **Nhân viên** — seed 45 người từ sheet «Danh sách nhân viên»
- **Báo cáo** — dashboard CEO toàn công ty

### Level 2 — Khu vực
- Danh sách tòa thuộc khu
- **＋ Tạo tòa nhà**: Mã tòa*, Địa chỉ, Số tầng, Quản lý (chức danh chứa Quản lý / Trưởng phòng)

### Level 3 — Tòa nhà
Giữ module vận hành:
Sơ đồ phòng+Kho · Hợp đồng · Thu tiền kỳ · Kiểm tra Bill · Báo cáo tòa · Khách hàng (stats clickable) · Thống kê xe · Cấu hình tòa · CSV.

## Dữ liệu
- Seed: KV1 → tòa 316 (Quản lý Nguyễn Khoa Triều Sơn) + stub 316A; KV2 trống
- Employees: `BARO_SEED.employees` `{stt, title, name}` × 45
- localStorage: `baro-house-v3` (schema 3). Legacy keys bị bỏ khi boot.

## Thiết kế
Accent `#6D28D9`, Be Vietnam Pro, tiếng Việt, breadcrumb `Baro House › Khu vực 1 › Tòa 316`.

## Files
`index.html`, `styles.css`, `app.js`, `data.js`, `README.md`
