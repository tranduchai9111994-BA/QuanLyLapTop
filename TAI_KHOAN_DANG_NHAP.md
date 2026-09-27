# Tài khoản đăng nhập demo (SmartLap)

> File này lưu thông tin tài khoản mẫu được tạo tự động bởi `backend/prisma/seed.ts` mỗi
> khi chạy seed (kể cả `--reset`). Dùng để đăng nhập thử các vai trò khác nhau trên hệ thống.

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Quản trị viên (ADMIN) | `admin@smartlap.vn` | `Demo@123` | Truy cập trang `/admin`: quản lý laptop, giá, benchmark, thương hiệu |
| Nhân viên tư vấn (STAFF) | `staff@smartlap.vn` | `Demo@123` | Xem tư vấn/đánh giá như nhân viên, không có toàn quyền admin |
| Khách hàng demo (CUSTOMER) | `khach@smartlap.vn` | `Demo@123` | Trải nghiệm luồng người dùng cuối (Wizard → Kết quả → So sánh) |

## Ghi chú

- Mật khẩu giống nhau cho cả 3 tài khoản chỉ vì đây là **dữ liệu demo phục vụ báo cáo/đồ án**,
  không dùng cho môi trường thật.
- Nguồn khai báo: [backend/prisma/seed.ts](backend/prisma/seed.ts) (hàm tạo user đầu file `main()`).
- Nếu đổi mật khẩu demo, nhớ sửa cả file này lẫn `seed.ts` để không bị lệch thông tin.
- Chạy `npx tsx prisma/seed.ts --reset` sẽ xoá và tạo lại đúng 3 tài khoản này (không đổi mật khẩu).
