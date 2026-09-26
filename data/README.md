# data/ — Ghi chú nguồn dữ liệu

## Trạng thái hiện tại: DỮ LIỆU MÔ PHỎNG (chưa phải dữ liệu thu thập thật)

Nhóm chưa thu thập xong catalog thị trường VN thật (250–350 máy từ nhà bán lẻ).
Để dựng khung code và huấn luyện thử mô hình, `generate_mock_catalog.py` sinh ra:

- `raw/catalog_vn_raw.xlsx` — 315 dòng mô phỏng, đúng cột theo `docs/03_DU_LIEU_VA_TIEN_XU_LY.md` §2.2.
- `processed/catalog_vn.csv` — bản đã gán `segment` (dùng để huấn luyện Mô hình A).
- `processed/cpu_benchmark.csv`, `processed/gpu_benchmark.csv` — điểm PassMark **mô phỏng**
  theo đúng thứ tự tương đối thực tế (CPU/GPU mạnh hơn → điểm cao hơn), **không phải số tra thật**.
- `personas/personas.json` — 30 persona kiểm thử (viết tay, không dùng để huấn luyện Mô hình A).

**Việc cần làm khi có dữ liệu thật:** nhóm thu thập theo `docs/03` §2, chạy hai người gán nhãn độc lập
40 mẫu để tính Cohen's kappa, rồi thay các file trên bằng dữ liệu thật (giữ nguyên tên cột/đường dẫn
để không phải sửa code phía sau).

## Phân bố mẫu theo phân khúc (dữ liệu mô phỏng hiện tại)

| Phân khúc | Số mẫu |
|---|---|
| OFFICE | 90 |
| ULTRABOOK | 85 |
| GAMING | 85 |
| CREATOR | 55 |
| **Tổng** | **315** |

Mọi lớp đều ≥ 50 mẫu — đạt tiêu chí nghiệm thu GĐ1.

## Cohen's kappa

Chưa tính được (cần hai người gán nhãn độc lập trên dữ liệu thật). Ghi chú: dữ liệu mô phỏng được
sinh trực tiếp theo `segment` nên không có bất đồng gán nhãn để đo — mục này **phải cập nhật lại**
khi thay bằng catalog VN thật thu thập thủ công.

## Kiểm tra chất lượng

Chạy `python -m app.data_check` (từ thư mục `ml-service/`) → xem `ml-service/app/data_check.py`.
Kết quả hiện tại: 315 mẫu, không lỗi trùng `sku`, không lỗi khớp benchmark CPU/GPU, không cột nào
thiếu quá 10%.
