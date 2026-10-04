# 15 — Hướng dẫn hiểu & trình bày 3 mô hình (theo phân công nhóm)

> Tài liệu học + nguồn để làm slide/báo cáo. Mọi con số đều **đã kiểm chứng bằng cách chạy lại
> mô hình thật** (artifact `clf-2026.09.27-012747`, `evaluation.json`) và truy được về file code.
> Phần của thành viên 2, 3 được bổ sung dần khi nhóm học xong từng mô hình.

| Thành viên | Mô hình | Làm gì (1 câu) | Thuật toán | Trạng thái tài liệu |
|---|---|---|---|---|
| **1** | **A** — phân loại phân khúc máy mới | Cho cấu hình 1 máy → đoán thuộc OFFICE / ULTRABOOK / GAMING / CREATOR | kNN phân lớp (Euclidean) | ✅ Hoàn chỉnh |
| **2** | **C** — hiểu câu tự do | Cho câu "con học kế toán, cần máy bền, rẻ" → nhóm nhu cầu | TF-IDF + kNN cosine | ⏳ Chờ bổ sung |
| **3** | **B** — xếp hạng top-5 | Cho nhu cầu + ngân sách → 5 máy phù hợp nhất | kNN khoảng cách một phía | ⏳ Chờ bổ sung |

**Cả 3 đều là kNN** (k láng giềng gần nhất) nhưng *đem ra so sánh cái khác nhau*:
A so sánh **máy với máy** để *bỏ phiếu ra nhãn*; C so sánh **câu với câu mẫu**; B so sánh **máy với
"máy lý tưởng"** để *xếp hạng*.

---

# PHẦN 1 — Thành viên 1: Mô hình A (phân loại phân khúc máy mới)

## 1.1 Bài toán và vị trí trong hệ thống

**Vấn đề:** cửa hàng nhập máy mới, không ai gán nhãn phân khúc bằng tay 1.000 lần. Nếu máy không có
nhãn thì hệ thống **không gợi ý được máy đó** cho khách (bước đồng bộ sang ML bỏ qua máy chưa có nhãn).

**Giải pháp:** Mô hình A nhìn cấu hình máy và **tự đoán phân khúc**, kèm **độ tin cậy**.

```
Nhân viên thêm máy (form)  ──►  Backend  ──POST /predict-segment──►  ML service (Mô hình A)
                                   ▲                                       │
                                   └──── { nhãn, xác suất từng lớp, 7 láng giềng đã bỏ phiếu } ◄──┘
        độ tin cậy ≥ 0,6  → nhãn VERIFIED (dùng ngay)
        độ tin cậy < 0,6  → NEEDS_REVIEW (vẫn gợi ý tạm, đưa vào hàng đợi "Duyệt nhãn" cho người xác nhận)
```

| | |
|---|---|
| **Đầu vào** | 11 đặc trưng cấu hình của 1 máy (RAM, SSD, điểm CPU, điểm GPU, màn hình, ppi, tần số quét, cân nặng, pin, có card rời, màn chuẩn màu). **Không có giá** (xem 1.4) |
| **Đầu ra** | Nhãn phân khúc + xác suất 4 lớp + 7 láng giềng đã bỏ phiếu |
| **Nơi dùng** | Nút "AI gợi ý phân khúc" khi thêm laptop; suy phân khúc từ hoạt động ở Wizard (chọn "Chưa rõ") |

## 1.2 Ý tưởng kNN bằng "bản đồ" (dễ giải thích với hội đồng)

1. **Mỗi máy là một điểm trên bản đồ** — các trục là các đặc trưng (điểm GPU, cân nặng, ...). Máy
   cấu hình giống nhau thì nằm **gần nhau**.
2. Máy mới cần đoán nhãn → đặt lên bản đồ → tìm **k = 7 máy đã có nhãn gần nhất**.
3. 7 máy đó **bỏ phiếu**; nhãn nhiều phiếu nhất là kết quả. Tỷ lệ phiếu chính là **độ tin cậy**.

> Giống hỏi ý kiến 7 người hàng xóm gần nhất xem "khu này là khu gì".

## 1.3 Công thức khoảng cách — không phải tự nghĩ ra, đó là Pytago

Trên giấy kẻ ô: máy A cách máy B **3 ô ngang** và **4 ô dọc**. Đường thẳng nối hai máy là cạnh huyền
tam giác vuông:

```
khoảng cách = √(3² + 4²) = √25 = 5            (định lý Pytago lớp 7)
```

Với nhiều đặc trưng, **cứ thêm số hạng vào trong căn** (gọi là *khoảng cách Euclidean*):

```
d(máy 1, máy 2) = √( Σ (đặc trưng_j của máy 1 − đặc trưng_j của máy 2)² )      j = 1..11
```

**Kiểm chứng bằng chạy thật** (máy "Acer Predator Helios 0051" và láng giềng gần nhất của nó):

| | Giá trị |
|---|---|
| Hiệu từng đặc trưng (đã chuẩn hóa) | `[1,26  0,00  0,12  −0,36  0,31  −0,98  0,00  −0,62  −0,21  0,00  0,00]` |
| Tổng bình phương | 3,2244 |
| Căn bậc hai (**tính tay**) | **1,7957** |
| Thư viện scikit-learn trả về | **1,7957** ✅ khớp tuyệt đối |

## 1.4 Dữ liệu đưa vào được xử lý thế nào (và vì sao)

Code: `ml-service/app/features.py` — `MODEL_A_FEATURES` (dòng 35), `build_model_a_preprocessor()` (dòng 225).

| Nhóm | Đặc trưng | Xử lý | Vì sao |
|---|---|---|---|
| Số, tỷ lệ gấp đôi | `ram_gb`, `ssd_gb` | điền thiếu bằng trung vị → **log₂** → chuẩn hóa | 8→16GB (gấp đôi) quan trọng ngang 16→32GB; log biến "gấp đôi" thành khoảng cách bằng nhau |
| Số thường | `cpu_score`, `gpu_score`, `screen_inch`, `ppi`, `refresh_hz`, `weight_kg`, `battery_wh` | điền thiếu → **chuẩn hóa z-score** | đưa về cùng thang đo |
| Nhị phân | `gpu_dedicated`, `srgb_100` | giữ nguyên 0/1 | đã ở thang 0–1 |

**Chuẩn hóa để làm gì?** Giống bản đồ có trục tính bằng km và trục tính bằng mm: trục nào số lớn sẽ
"nuốt" hết trục kia. Chuẩn hóa quy mọi trục về cùng thước đo trước khi đo khoảng cách.

**Quyết định thiết kế D-04: KHÔNG đưa giá vào Mô hình A.** Nếu đưa giá, mô hình sẽ học phân khúc theo
*giá* thay vì theo *cấu hình thật* → 2 máy cùng cấu hình khác giá bị xếp khác phân khúc, vô lý về kỹ
thuật. (Giá chỉ được dùng ở Mô hình B.)

## 1.5 Ví dụ thật chạy từ mô hình

**Ví dụ 1 — Chắc chắn.** `ASUS TUF Gaming 0001` (GPU 52,1 · RAM 8GB · 2,51kg · 144Hz · card rời):

| Láng giềng | #1 | #2 | #3 | #4 | #5 | #6 | #7 |
|---|---|---|---|---|---|---|---|
| Khoảng cách | 0,00 (chính nó) | 1,79 | 1,83 | 1,99 | 2,12 | 2,14 | 2,24 |
| Nhãn | GAMING | GAMING | GAMING | GAMING | GAMING | GAMING | GAMING |

→ 7/7 phiếu GAMING ⇒ **GAMING, tin cậy 100%** → tự duyệt.

**Ví dụ 2 — Ranh giới.** `Acer Predator Helios 0051` (nhãn thật CREATOR; CPU 42,4 · GPU 16,7 · RAM 32GB):

| Láng giềng | #1 | #2 | #3 | #4 | #5 | #6 | #7 |
|---|---|---|---|---|---|---|---|
| Khoảng cách | 1,80 | 2,02 | 2,11 | 2,13 | 2,19 | 2,19 | 2,29 |
| Nhãn | CREATOR | CREATOR | CREATOR | OFFICE | ULTRABOOK | ULTRABOOK | ULTRABOOK |

→ CREATOR 3 phiếu, ULTRABOOK 3 phiếu, OFFICE 1 phiếu ⇒ xác suất **0,43 / 0,43 / 0,14**, độ tin cậy
**43% < 60%** ⇒ trạng thái **NEEDS_REVIEW**, đưa vào hàng đợi cho người xác nhận.
**Đây chính là lý do hệ thống có hàng đợi "Duyệt nhãn"** (máy này cấu hình lai, AI không đủ chắc).

## 1.6 Chọn tham số — "ta không biết trước, nên thử rồi đo"

Code: `ml-service/app/classifier.py` — `PARAM_GRID` (dòng 34–38), `grid_search()` (dòng 56).

`GridSearchCV` thử **mọi tổ hợp** rồi chọn bộ có macro-F1 cao nhất bằng kiểm thử chéo 5 phần:

| Tham số | Các giá trị thử | Chọn được |
|---|---|---|
| `k` (số láng giềng) | 1, 3, 5, …, 31 (số lẻ để tránh hòa phiếu) | **7** |
| Cách đo khoảng cách | Euclidean (đường thẳng) / Manhattan (đi theo ô phố) | **Euclidean** |
| Trọng số phiếu | `uniform` (mỗi người 1 phiếu) / `distance` (gần thì phiếu nặng) | **uniform** |

**k nhỏ quá** (1–3) → nhạy với mẫu lạ (overfit). **k lớn quá** → mờ ranh giới, thiên về lớp đông.
Có sẵn biểu đồ "đường cong chọn k" trong `artifacts/<phiên bản>/k_curve.png` để đưa lên slide.

## 1.7 Kết quả và đánh giá

| Chỉ số | Giá trị | Giải thích |
|---|---|---|
| macro-F1 kiểm thử chéo 5 phần (`evaluate.py`) | **0,773** (±0,044) | Chạy lại trung thực trên cả 1.000 máy — **số nên dùng khi báo cáo** |
| macro-F1 trên tập test giữ riêng 20% | **0,787** | Máy mô hình chưa từng thấy |
| macro-F1 do GridSearch báo (`train.py`) | 0,794 | Hơi **lạc quan** (là điểm của "người thắng" trong nhiều tổ hợp) — chỉ để tham khảo |
| Baseline đoán lớp đông nhất (Dummy) | 0,128 | kNN vượt **+0,658** |
| Baseline luật if-else tự viết | 0,632 | kNN vượt **+0,155** |

**Vì sao chấm bằng macro-F1 chứ không phải độ chính xác thường?** Chỉ đoán "GAMING/OFFICE" cho mọi máy
vẫn đúng phần lớn nhưng bỏ sót hẳn CREATOR (lớp ít mẫu). macro-F1 tính F1 *riêng từng lớp* rồi lấy
trung bình đều nên phạt đúng chỗ đó.

Theo từng lớp (kiểm thử chéo, 1.000 máy):

| Phân khúc | Số máy | Precision | Recall | Nhận xét |
|---|---|---|---|---|
| OFFICE | 344 | 0,82 | 0,91 | Tốt |
| GAMING | 335 | 0,85 | 0,94 | Tốt nhất |
| ULTRABOOK | 201 | 0,84 | 0,74 | Khá — 51 máy bị đoán nhầm là OFFICE |
| CREATOR | 120 | 0,77 | **0,44** | **Yếu nhất** — 49/120 máy CREATOR bị đoán thành GAMING |

**Vì sao CREATOR ↔ GAMING nhầm nhau?** Hai nhóm dùng cấu hình phần cứng gần giống (GPU mạnh, RAM
nhiều), chỉ khác *mục đích sử dụng*. Đây là hạn chế đã biết và chấp nhận được; ranh giới ngoài đời
thật cũng mờ như vậy.

## 1.7b Không "rò rỉ dữ liệu" (điểm kỹ thuật hay hỏi)

Bước chuẩn hóa **nằm trong `Pipeline`** (`classifier.py` dòng 41–53), không fit ngoài. Nếu fit ngoài,
khi kiểm thử chéo bộ chuẩn hóa đã "nhìn thấy" dữ liệu kiểm tra → điểm cao giả (*data leakage*).
Trong Pipeline, scikit-learn tự fit lại bộ chuẩn hóa **chỉ trên tập huấn luyện của mỗi phần**.
Có test chặn lỗi này: `ml-service/tests/test_classifier.py` (`test_scaler_inside_pipeline`).

## 1.8 Bản đồ file để mở xem (tính từ `D:\QL_Laptop`)

| Việc | File |
|---|---|
| Đặc trưng + tiền xử lý | `ml-service/app/features.py` |
| Mô hình, GridSearch, baseline, đường cong k | `ml-service/app/classifier.py` |
| Huấn luyện + lưu phiên bản | `ml-service/app/train.py`, `ml-service/app/registry.py` |
| Đo lại kiểm thử chéo, ma trận nhầm lẫn | `ml-service/app/evaluate.py`, `ml-service/artifacts/evaluation.json` |
| Endpoint `/predict-segment` | `ml-service/app/main.py` (dòng 100) |
| Backend: gọi mô hình + quyết định VERIFIED/NEEDS_REVIEW | `backend/src/modules/laptops/segment.service.ts` (`applySegmentLabel`, dòng 118) |
| Giao diện gợi ý phân khúc + 7 láng giềng | `frontend/src/components/admin/SegmentSuggester.tsx` |
| Hàng đợi duyệt nhãn + khóa nhãn | `frontend/src/pages/admin/AdminReviewQueue.tsx` |
| Kiểm thử | `ml-service/tests/test_classifier.py` |
| Tham số/kết quả từng phiên bản | `ml-service/artifacts/<phiên bản>/metadata.json` |

## 1.9 Câu hỏi hội đồng dự kiến và gợi ý trả lời

1. **Vì sao dùng kNN mà không phải mô hình khác?** Dữ liệu nhỏ (1.000 máy), cần *giải thích được*:
   hiển thị luôn 7 máy đã bỏ phiếu. kNN không "hộp đen", rất hợp hệ thống cần minh bạch.
2. **Công thức khoảng cách lấy ở đâu ra?** Là khoảng cách Euclidean = Pytago nhiều chiều; đã kiểm tra
   tính tay trùng thư viện (1,7957). Ta cũng thử Manhattan, Euclidean cho kết quả tốt hơn.
3. **Vì sao k = 7?** Không đoán — thử k = 1…31 bằng kiểm thử chéo, k = 7 cho macro-F1 cao nhất; có
   đường cong chọn k làm bằng chứng.
4. **Làm sao biết không chỉ "đoán đúng nhờ may"?** So với 2 baseline (đoán lớp đông: 0,128; luật
   if-else: 0,632); kNN đạt 0,773–0,787.
5. **Vì sao không đưa giá vào?** Để mô hình học theo *cấu hình*, không theo *giá* (quyết định D-04).
6. **Khi AI không chắc thì sao?** Độ tin cậy < 0,6 → NEEDS_REVIEW, người xác nhận; có thể **khóa
   nhãn** để mô hình không ghi đè quyết định của con người.
7. **Hạn chế?** CREATOR ↔ GAMING nhầm lẫn (recall CREATOR 0,44); dữ liệu là **tổng hợp có logic**,
   chưa phải catalog thu thập thật (xem `docs/14_KET_QUA_THUC_NGHIEM.md` mục 7).

## 1.10 Gợi ý khung slide (5–6 slide)

1. **Vấn đề:** máy mới không có nhãn → không được gợi ý. Sơ đồ luồng ở 1.1.
2. **Ý tưởng kNN:** hình bản đồ + 7 láng giềng bỏ phiếu (1.2). *Hình: 1 chấm đỏ giữa các chấm 4 màu.*
3. **Công thức:** ví dụ 3-4-5 → công thức nhiều chiều → bảng kiểm chứng 1,7957 = 1,7957 (1.3).
4. **Dữ liệu đưa vào:** bảng 11 đặc trưng, log₂ cho RAM/SSD, vì sao không có giá (1.4).
5. **Ví dụ thật:** 2 bảng láng giềng (chắc chắn 7/7 vs ranh giới 3-3-1 → duyệt tay) (1.5).
6. **Kết quả:** bảng macro-F1 vs 2 baseline + ma trận nhầm lẫn + hạn chế CREATOR (1.7).

---

# PHẦN 2 — Thành viên 2: Mô hình C (hiểu câu tự do, TF-IDF + kNN cosine)

*(Sẽ bổ sung khi nhóm học xong. Code: `ml-service/app/text_classifier.py`; giao diện: ô nhập câu ở Wizard.)*

# PHẦN 3 — Thành viên 3: Mô hình B (xếp hạng top-5, kNN khoảng cách một phía)

*(Sẽ bổ sung khi nhóm học xong. Code: `ml-service/app/retriever.py`, `ml-service/app/explain.py`; giao diện: trang Kết quả + "Vì sao gợi ý?".)*
