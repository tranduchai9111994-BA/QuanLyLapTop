# ml-service — SmartLap ML (FastAPI + scikit-learn)

## Chạy

```bash
pip install -r requirements.txt
python -m app.data_check        # kiểm tra dữ liệu
python -m app.train              # huấn luyện Mô hình A, sinh artifacts/<version>/
python -m app.ablation            # thí nghiệm cắt bỏ + so sánh cấu hình mất cân bằng
pytest                             # 9 test bắt buộc (docs/04 §9)
uvicorn app.main:app --reload --port 8001
```

## Kết quả hiện tại (dữ liệu mô phỏng — xem `data/README.md`)

- Test macro-F1 = 0,957 (mục tiêu ≥ 0,75) — **lưu ý**: dữ liệu mô phỏng có ranh giới phân khúc
  tách bạch hơn dữ liệu thị trường thật, nên số này sẽ **thấp hơn** khi thay bằng catalog VN thật.
- Vượt baseline đa số (`DummyClassifier`): +0,846 (mục tiêu ≥ 0,30) — đạt.
- Vượt baseline luật thủ công: **chưa đạt** trên dữ liệu mô phỏng (chênh -0,043, mục tiêu ≥ 0,05).
  Nguyên nhân: dữ liệu mô phỏng được sinh theo đúng các ngưỡng mà luật thủ công kiểm tra
  (`gpu_dedicated & refresh ≥ 120`, `weight ≤ 1.4`, …) nên luật gần như hoàn hảo trên tập này.
  Đây là hạn chế của dữ liệu giả lập — **cần chạy lại phép so sánh này khi có catalog VN thật**,
  vì trong dữ liệu thị trường thật các ranh giới sẽ mờ hơn nhiều và kỳ vọng kNN sẽ vượt trội.
- Ablation: bỏ `refresh_hz` làm giảm rõ rệt macro-F1 (0,986 → 0,923), đúng như kỳ vọng (GAMING
  phụ thuộc nhiều vào tần số quét). Bỏ `srgb_100` giảm nhẹ (ảnh hưởng CREATOR). "Không
  StandardScaler" giảm ít trên dữ liệu mô phỏng (vì các đặc trưng đã được sinh ở thang tương đối
  gần nhau) — với dữ liệu thật có `price_vnd`/`ssd_gb` chênh lệch hàng chục nghìn lần thang đo,
  hiệu ứng sẽ rõ hơn nhiều (xem `docs/03_DU_LIEU_VA_TIEN_XU_LY.md` §5.2).
- Thí nghiệm đối chứng Kaggle: **chưa thực hiện** — nhóm cần tự tải `laptop_price.csv` từ Kaggle,
  kiểm tra giấy phép, rồi chạy `app/train.py` với dataset đó (chưa có sẵn trong phiên làm việc này).

## Việc còn thiếu (so với docs/06 §2 kiến trúc mã nguồn)

- `registry.py` mới hỗ trợ activate theo version cục bộ (chưa có "kiểm quy tắc" so sánh với
  golden_test khi promote — xem `docs/09_VONG_DOI_TRI_TUE.md` §2.3, sẽ làm ở backend `/models/:version/promote`).
