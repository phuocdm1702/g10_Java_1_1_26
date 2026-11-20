# Polo House — Hướng dẫn luồng & chia việc sprint 16–18/11

Deadline: **17:00 ngày 18/11/2026**  
Repo: `g10_Java_1_1_26`  
Stack: Spring Boot (Java 21, SQL Server) + React/Vite (Ant Design)

Mọi người đọc phần **luồng** trước, rồi nhảy thẳng xuống **việc của mình**. Có thắc mắc về khung/cấu trúc thì nhắn **Mạnh Phước**; phần tài liệu/slide do nhóm trưởng lo, không cần viết thêm doc trong code.

---

## 1. Chạy dự án

- Backend: thư mục `DATN/`, Spring Boot port **8080**, cấu hình SQL Server trong `DATN/src/main/resources/application.properties`
- Frontend: thư mục `frontend/`, `npm install` rồi `npm run dev` → **http://localhost:5173**
- API prefix: `http://localhost:8080/api`
- Ảnh tĩnh hiện tại: `http://localhost:8080/uploads/...`

Hai phiên đăng nhập tách nhau (localStorage):

- Khách: `/dang-nhap`, `/dang-ky`
- Nhân viên: `/admin/login`

Vai trò admin: `ADMIN`, `MANAGER`, `SALES`, `WAREHOUSE`, `SUPPORT`

---

## 2. Luồng khách hàng (online)

```
Trang chủ / Danh sách SP → Chi tiết (chọn màu, size) → Giỏ hàng
    → Đăng nhập (bắt buộc khi thanh toán)
    → Checkout COD → Đặt hàng thành công
    → Tài khoản: hồ sơ, sổ địa chỉ, đổi MK, đơn của tôi (xem / hủy)
```

Chi tiết từng bước:

| Bước | Frontend | Backend |
|---|---|---|
| Xem SP, lọc, tìm | `frontend/src/pages/user/Home.jsx`, `DanhSachSanPham.jsx`, `ProductDetail.jsx` | `GET /api/public/san-pham/**` |
| Giỏ hàng | `CartContext.jsx` — khách vãng lai lưu máy, login thì gộp + sync server | `POST /api/public/gio-hang/xem`, `GET/PUT /api/user/gio-hang` |
| Thanh toán | `ThanhToan.jsx` — bắt buộc login, gửi `phuongThuc: 'COD'` | `POST /api/user/dat-hang/tinh-tien`, `POST /api/user/dat-hang` |
| Đơn của tôi | `DonHangCuaToi.jsx`, `ChiTietDonHang.jsx` | `GET /api/user/don-hang`, `POST .../{ma}/huy` |

Quy tắc đặt hàng hiện tại (`DonHangService`):

- Trừ tồn kho ngay khi đặt
- Hóa đơn: `hinhThucMuaHang = "Online"`, `phuongThucThanhToan = "Thanh toán khi nhận hàng"`, `trangThaiThanhToan = "Chưa thanh toán"`, `trangThai = "Chờ xác nhận"`
- Phí ship mặc định 30.000 ₫, miễn phí từ 500.000 ₫
- **Chỉ nhận COD** (`DatHangRequest` regex `"COD"`)

---

## 3. Luồng admin

Menu `/admin`:

1. Thống kê — KPI, biểu đồ, bán chạy
2. Hóa đơn — lọc, đổi trạng thái, sửa thông tin, hoàn tiền, tạo đơn đền bù
3. Sản phẩm — CRUD áo, biến thể màu–size, ảnh, bật/tắt kinh doanh
4. Thuộc tính — màu, kích thước, chất liệu, thương hiệu
5. Phiếu giảm giá / Đợt giảm giá
6. Khách hàng / Nhân viên (nhân viên chỉ Admin)

Luồng xử lý đơn online:

```
Chờ xác nhận → Đã xác nhận → Đang giao hàng → Đã hoàn thành
                                    ↘ Đã hủy (+ hoàn kho nếu đã trừ)
```

Hóa đơn có field `hinhThucMuaHang`: `Online` | `Tại quầy`. **Lọc tại quầy đã có, nhưng chưa có màn tạo đơn tại quầy.**

---

## 4. Luồng ảnh (quan trọng cho Tú + Quỳnh)

Hiện **không lưu file trong DB**. File nằm ổ đĩa máy chạy backend; DB chỉ lưu path.

```
Admin upload (AnhSanPham)
  → AnhService ghi file vào thư mục uploads/
  → bảng Anh.anh_url = "/uploads/{uuid}.jpg|png|webp"
  → WebConfig serve GET /uploads/** (public, không JWT)
  → Client: imgUrl() ghép "http://localhost:8080" + path → <img>
```

- Ảnh gắn **sản phẩm + màu**. `id_mau = null` = ảnh chung.
- Mỗi nhóm tối đa 8 ảnh. Ảnh chính = `thu_tu` nhỏ nhất.
- Cửa hàng chọn ảnh: đúng màu đang chọn, không có thì ảnh chung. Không có URL / load lỗi → vẽ áo SVG theo mã màu (`ProductImage.jsx`).

File chính:

- Upload: `DATN/.../service/AnhService.java`, `controller/AnhController.java`
- Serve file: `config/WebConfig.java`
- Admin UI: `frontend/src/components/admin/AnhSanPham.jsx`
- Client: `frontend/src/data/products.js` (`imgUrl`, `imagesFor`), `ProductImage.jsx`, `ProductCard.jsx`, `ProductDetail.jsx`

Lưu ý: cột `SanPhamChiTiet.anh_url` gần như **không được ghi** khi upload. Giỏ hàng / đơn khách lấy ảnh từ bảng `Anh`. Chi tiết hóa đơn admin đang đọc `v.getAnhUrl()` trên biến thể → dễ trống. Khi chuyển cloud, thống nhất **một nguồn URL**.

---

## 5. Chia việc sprint này

### @Phong — Bán hàng offline tại quầy (chính)

Mục tiêu: nhân viên tạo đơn ngay tại quầy, trừ kho, ra hóa đơn `hinhThucMuaHang = "Tại quầy"`.

Gợi ý phạm vi tối thiểu (phải xong trước deadline):

- Màn POS trong admin (role `ADMIN`, `MANAGER`, `SALES` — cùng quyền hóa đơn)
- Chọn biến thể (màu/size), số lượng, khách lẻ hoặc khách có sẵn
- Thanh toán tiền mặt (và nếu kịp: chuyển khoản tay)
- Trừ tồn, tạo `HoaDon` + `HoaDonChiTiet`, trạng thái nên **Đã hoàn thành** + **Đã thanh toán** (khác đơn online)
- In / xem lại đơn trong Quản lý hóa đơn (filter Tại quầy đã có)

File neo sẵn:

- Entity: `DATN/.../entity/HoaDon.java`
- Admin đơn: `HoaDonAdminController.java`, `frontend/src/pages/admin/HoaDon.jsx`
- Menu: `frontend/src/components/admin/AdminLayout.jsx`, `frontend/src/auth/roles.js`
- Security: `SecurityConfig.java` — thêm path mới nếu không nằm dưới `/api/admin/hoa-don`

Không đụng luồng checkout online trừ khi thống nhất với Đức Thanh (cùng bảng `HoaDon`).

### @Phúc Lê — Hỗ trợ Phong

Làm cặp với Phong. Ưu tiên:

- UI POS, tìm sản phẩm/khách, in hóa đơn
- Test: trừ kho đúng, đơn hiện tab Tại quầy, không làm hỏng đơn Online
- Viết vài case test tay (checklist) gửi nhóm trước 17h ngày 18

Không mở nhánh tính năng riêng nếu Phong chưa chốt API.

### @Đức Thanh — Sửa COD online (+ VNPay nếu kịp)

**Bắt buộc:** khách đặt hàng Online bằng COD phải ra được hóa đơn.

Luồng hiện tại đã gắn cứng COD:

- FE: `frontend/src/pages/user/ThanhToan.jsx` → `POST /user/dat-hang` với `phuongThuc: 'COD'`
- BE: `DatHangController`, `DonHangService`, `DatHangRequest` (chỉ nhận `"COD"`)

Checklist debug (làm theo thứ tự):

1. Đã login khách chưa? Checkout bắt buộc JWT `ROLE_KHACH_HANG`. Chưa login bị đẩy `/dang-nhap`.
2. Token hết hạn → interceptor 401 xóa session.
3. Validation: SĐT `^(0|+84)\d{9}$`, tỉnh/quận/xã/đường bắt buộc.
4. Tồn kho / SP ngừng bán → `RuntimeException` hiện trên form.
5. Lỗi SQL constraint trên `Hoa_don` (trạng thái, tiền, PTTT) — xem log backend khi bấm Đặt hàng.
6. CORS / backend chưa chạy → message “Kiểm tra backend đã chạy chưa.”
7. Confirm: đơn mới vào admin, trạng thái Chờ xác nhận, PTTT COD, thanh toán Chưa thanh toán.

**Nếu kịp:** thanh toán online.

- Cột đã có: `phuong_thuc_thanh_toan_online`, `ma_giao_dich`, `trang_thai_thanh_toan`
- Admin đã có nút hoàn phí: `POST /api/admin/hoa-don/{id}/hoan-phi`
- Hiện FE ghi “Thanh toán trực tuyến sẽ được bổ sung sau.”

Nếu làm VNPay: sandbox, lưu `ma_giao_dich`, chỉ tạo/cập nhật đơn khi callback thành công, không phá COD.

### @Đặng Đình Anh Tú — Ảnh lên cloud

Mục tiêu: không phụ thuộc thư mục `uploads/` trên máy local.

Việc cần làm:

- Chọn cloud (Cloudinary / S3 / Azure Blob — chốt 1, ghi env, **không commit secret**)
- Sửa `AnhService.upload`: upload cloud, lưu **URL đầy đủ** (hoặc path + base URL config) vào `Anh.anh_url`
- Sửa xóa ảnh: xóa trên cloud, không chỉ xóa file local
- Giữ API admin: `GET/POST /api/admin/san-pham/{id}/anh`, `PUT /api/admin/anh/{id}/chinh`, `DELETE /api/admin/anh/{id}`
- Vẫn JPG/PNG/WEBP, max 5MB, 8 ảnh/nhóm

Phối hợp Quỳnh: **contract URL** — FE nhận `https://...` thì `imgUrl()` đã pass-through (`/^https?:/` không ghép localhost). Nếu vẫn trả `/uploads/...` thì phải có `app.public-base-url`.

Nên đồng bộ luôn `SanPhamChiTiet.anh_url` (ảnh chính theo màu) để hóa đơn admin không trống.

### @Trần Quỳnh — Hiển thị ảnh client (cặp Tú)

Sau khi Tú trả URL cloud:

- Kiểm tra `imgUrl` / `imagesFor` trong `frontend/src/data/products.js`
- Thẻ SP, chi tiết, giỏ, drawer, thanh toán, đơn của tôi, admin xem ảnh
- Fallback `ProductImage` (áo SVG) khi URL lỗi
- Test: ảnh theo màu, ảnh chung, hover ảnh 2, thumbnail chi tiết

Không đổi logic upload; nếu URL sai thì báo Tú, đừng hardcode localhost ở từng page.

### @Mạnh Phước — Tạm nghỉ

Khung dự án đã xong. Không nhận task sprint này. Nhóm nhắn khi kẹt cấu trúc / security / chạy được máy.

### Nhóm trưởng — Tài liệu & slide

Chuẩn bị slide demo: luồng khách, admin, (nếu kịp) POS + ảnh cloud + COD. Không merge code trừ conflict chia việc.

---

## 6. Definition of done (chung)

Mỗi người trước 17h ngày 18:

- [ ] Chức năng chạy trên máy mình, backend 8080 + frontend 5173
- [ ] Không phá login, giỏ hàng, danh sách SP
- [ ] Push nhánh riêng, không push thẳng `main` nếu chưa thống nhất
- [ ] Comment Zalo: làm được gì / chưa kịp / file đã sửa

Ưu tiên nếu thiếu giờ:

1. COD online chạy được (Đức Thanh)
2. POS tạo được 1 đơn tại quầy (Phong + Phúc)
3. Ảnh cloud + hiện đúng trên client (Tú + Quỳnh)
4. VNPay chỉ làm khi COD đã xong

---

## 7. Liên hệ nhanh trong code

| Việc | Điểm vào |
|---|---|
| Checkout COD | `ThanhToan.jsx`, `DatHangController.java`, `DonHangService.java` |
| Hóa đơn admin | `HoaDon.jsx`, `HoaDonAdminService.java` |
| Ảnh | `AnhService.java`, `AnhSanPham.jsx`, `products.js`, `ProductImage.jsx` |
| Quyền | `SecurityConfig.java`, `roles.js` |
| Menu admin | `AdminLayout.jsx` |
