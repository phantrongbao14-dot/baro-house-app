# Baro House — Tòa nhà 316

MVP demo quản lý tòa nhà cho Baro House (Tòa nhà 316).
SPA HTML/CSS/JS thuần từ Google Sheet Test app / Lộ trình làm app (Khu vực 1 · Quản lý Sơn).

## Chạy nhanh
Mở `index.html` hoặc publish static (here.now). Không cần build/backend.

## Tabs (schema v2)
- **Sơ đồ phòng + Kho**: tầng G–5, filter tiles, chip trạng thái, panel 6 mục (HĐ thuê, HĐ cọc, KH, Xe, Tài sản, Lịch sử); sub-tab Kho tài sản (chuyển phòng ↔ kho)
- **Hợp đồng thuê**: banner tổng cọc, thẻ HĐ thuê/cọc, lập/sửa/gia hạn/thanh lý, KT khóa, xác nhận cọc, chuyển cọc→thuê (mock PDF/phiếu thu)
- **Thu tiền kỳ**: mở kỳ tuần tự; điện cũ/mới, nước cũ/mới, phát sinh, nội dung, đã thu CK; Lưu → Yêu cầu lập bill; trạng thái draft→saved→pending_kt→approved; modal bill Tải về/Chia sẻ
- **Kiểm tra Bill**: hàng đợi chờ duyệt + Xác nhận bill + breakdown
- **Báo cáo**: tiles, bar chart CSS, donut SVG, bảng theo tòa
- **Khách hàng**: CRUD + soft delete «Chuyển ra»
- **Thống kê xe**: fuzzy tìm biển (bỏ dấu chấm/gạch/khoảng trắng), cảnh báo trùng biển
- **Cấu hình tòa**: giá điện/nước/DV/xe, ngân hàng, reset seed
- **Import / Export CSV**: xuất CSV tòa/phòng; import đọc header + đếm dòng (demo)

## Dữ liệu
Seed sheet 316 (MB Nguyễn Phước Sơn, VP trống, …).
localStorage: `baro-house-316-v1` (schema 2). Reset qua Cấu hình tòa.

## Thiết kế
Accent #6D28D9 (tím = Bảo), Be Vietnam Pro, mobile, toast.

## Files
`index.html`, `styles.css`, `app.js`, `data.js`, `README.md`

MVP demo UI — thao tác In PDF / Phiếu thu / Thanh lý / Chia sẻ Zalo là mock toast.
