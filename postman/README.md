# Test API DECOHO bằng Postman

1. Chạy backend mới: `npm run start:dev` trong thư mục `DECOHO`.
2. Import `DECOHO.postman_collection.json` vào Postman.
3. Trong Collection → Variables, đặt `baseUrl` là `http://localhost:3001/api`. Khi test Render, dùng `https://decoho-be.onrender.com/api` sau khi đã deploy backend mới.
4. Nhập `adminEmail`, `adminPassword` của bạn trong Postman. Không đưa mật khẩu hoặc token thật vào Git.
5. Chạy **01 Auth - Tokens → Admin Login**. Script tự lưu `adminAccessToken` và `adminRefreshToken`.

## Xóa moodboard

Trong **14 Product Space & Showroom 3D (Updated)**:

- Chạy **Admin Product Spaces** để xem ID moodboard.
- Xóa một: điền `moodboardDeleteId`, chạy **Delete One Moodboard**. Thành công trả HTTP 200 và `deletedCount`.
- Xóa nhiều: điền `moodboardDeleteIds` dưới dạng JSON, ví dụ `["MB-TEST-01", "MB-TEST-02"]`, chạy **Delete Multiple Moodboards**. Thành công trả HTTP 201 và `deletedCount`.
- Tối đa 100 ID khác nhau mỗi lần; mảng rỗng hoặc ID không hợp lệ trả 400. ID không còn tồn tại được bỏ qua.
- Các request này xóa dữ liệu thật. Chỉ chọn moodboard thử nghiệm. Sản phẩm danh mục và ảnh cloud được giữ lại.
- **Replace Moodboard Image**: đặt `productSpaceId`, chọn file ở Body → form-data → image.

## Dashboard và link mua hàng

- **Dashboard** gọi `/admin/dashboard`; **Dashboard Revenue** gọi `/admin/dashboard/revenue`.
- **Open Product Affiliate Link** dùng `productId` để gọi `/products/:id/redirect`, trả 302 tới `productLink`. Request đã tắt tự động theo redirect để xem header Location.
- Source backend hiện tại không có `/affiliate/dashboard` hoặc `/affiliate/clicks`; collection không thêm hai route này.

## Lỗi thường gặp

- 404: kiểm tra `baseUrl`, backend đang chạy và bản build/deploy có route mới.
- 401: chạy lại Admin Login; kiểm tra Environment có ghi đè token hoặc baseUrl của Collection không.
- 403: tài khoản chưa có quyền admin.
- EADDRINUSE 3001: đang có một backend khác chiếm cổng.

Không chạy toàn bộ collection bằng Runner trên dữ liệu thật: collection chứa các request tạo, sửa và xóa.
