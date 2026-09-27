# ml-service — SmartLap ML (FastAPI + scikit-learn)

## Chạy

```bash
pip install -r requirements.txt
python -m app.data_check         # kiểm tra dữ liệu
python -m app.train               # huấn luyện Mô hình A + C, sinh artifacts/<version>/
python -m app.evaluate             # đánh giá Mô hình A/B/C so baseline (P@5, nDCG@5, macro-F1)
pytest                              # 34 test (retriever, classifier, text_classifier, độ nhạy ưu tiên, personas)
uvicorn app.main:app --reload --port 8001
```

## 3 mô hình kNN trong service này

| | File | Loại bài toán | Dùng khi nào |
|---|---|---|---|
| Mô hình A | `app/classifier.py` | Phân lớp (`KNeighborsClassifier`) | Đoán phân khúc cho máy mới (admin thêm laptop) |
| Mô hình B | `app/retriever.py` | Truy hồi có trọng số, khoảng cách một phía (`NearestNeighbors`) | Gợi ý top-N máy theo hồ sơ nhu cầu (màn "Kết quả") |
| Mô hình C | `app/text_classifier.py` | Phân lớp văn bản (TF-IDF + kNN cosine) | Hiểu câu nhu cầu tự do người dùng gõ (màn Wizard) |

Giải thích đầy đủ (lịch sử, nguyên lý, ví dụ, trích dẫn code) ở
[`../docs/GIAI_THICH_THUAT_TOAN_KNN.md`](../docs/GIAI_THICH_THUAT_TOAN_KNN.md).

## Kết quả hiện tại

Số liệu đo lường đầy đủ (macro-F1, P@5/nDCG@5, so baseline, đo công sức tìm kiếm) nằm ở
[`../docs/KET_QUA_THUC_NGHIEM.md`](../docs/KET_QUA_THUC_NGHIEM.md) — đây là **nguồn số liệu duy nhất, cập
nhật mỗi lần retrain**; không chép lại con số cụ thể ở file này để tránh bị lệch mỗi khi dữ liệu
đổi (file này từng có số liệu cũ từ giai đoạn dữ liệu mô phỏng ban đầu, đã bị lỗi thời và gỡ bỏ).

Tóm tắt việc chạy để tái tạo số liệu mới nhất:
```bash
python -m app.train      # in macro-F1 CV/test, luu artifact
python -m app.evaluate   # in P@5/nDCG@5, cap nhat artifacts/evaluation.json
```

## Việc còn thiếu

- `registry.py` hỗ trợ activate theo version cục bộ, chưa có "kiểm quy tắc" so sánh với
  `golden_test` khi promote (xem `docs/09_VONG_DOI_TRI_TUE.md` §2.3).
- Hạn chế về dữ liệu/thực nghiệm (Kaggle, ablation khuyến mãi, quy mô Mô hình C…): xem
  [`../docs/KET_QUA_THUC_NGHIEM.md`](../docs/KET_QUA_THUC_NGHIEM.md) mục 7.
