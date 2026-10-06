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

## 1.0 Toàn bộ luồng Mô hình A trong một trang (để trình bày)

**Nói trong 30 giây:** Máy mới vào hệ thống chưa có phân khúc. Mô hình A chuẩn hóa 11 thông số của máy, tìm 7 máy
đã biết nhãn giống nhất, cho 7 máy đó bỏ phiếu để ra phân khúc kèm xác suất. Xác suất dưới 0,6 thì máy vào hàng đợi
cho nhân viên xác minh. Mô hình được chọn tham số bằng cách thử 64 tổ hợp, chấm trên 200 máy giấu, đạt macro-F1 0,787
so với mốc luật tay 0,632 và đoán bừa 0,128.

**Hai giai đoạn, cùng một mô hình:**

| Giai đoạn | Việc | Ý chính | Chỗ trong code |
|---|---|---|---|
| Huấn luyện (chạy một lần, ngoại tuyến) | Chia dữ liệu | 800 máy học, 200 máy giấu; giữ tỷ lệ 4 phân khúc; seed 42 | `lifecycle/train.py:53` |
| | Chọn tham số | thử 16 k x 2 cách phiếu x 2 cách đo = 64 tổ hợp, kiểm thử chéo 5 phần = 320 lần học; chuẩn hóa nằm trong Pipeline | `models/classifier.py:21`, `:40` |
| | Chấm điểm | đoán 200 máy giấu, ra ma trận nhầm lẫn, precision, recall, macro-F1 0,787 | `lifecycle/train.py:69-72` |
| | So mốc | dummy 0,128; luật tay 0,632; kNN hơn rõ | `models/classifier.py:48`, `:64` |
| | Lưu | thư mục phiên bản: `model.joblib`, `metadata.json`, 2 ảnh | `lifecycle/train.py:86-130` |
| Phục vụ (mỗi lần có máy mới) | Backend gửi 11 thông số | `predictSegment` | `backend/.../laptops/segment.service.ts` |
| | ML chuẩn hóa, tìm 7 láng giềng, đếm phiếu | xác suất = số phiếu ÷ 7 | `app/main.py:98` |
| | Backend so với ngưỡng 0,6 | từ 5/7 phiếu: VERIFIED; thấp hơn: NEEDS_REVIEW | `segment.service.ts:138` |

**Năm con số cần nhớ:** 7 (số láng giềng), 64 tổ hợp, 0,787 (macro-F1), 0,6 (ngưỡng tin cậy), 0,375 (recall CREATOR, điểm yếu).

**Ba câu dễ bị hỏi:**
1. Vì sao k = 7? Hệ thống tự thử k lẻ từ 1 đến 31, k = 7 có điểm cao nhất (0,794); k = 9 chỉ kém 0,009, trong phạm vi dao động.
2. Vì sao dùng macro-F1 thay vì accuracy? Dữ liệu lệch lớp (CREATOR 12%); accuracy 0,85 che mất việc CREATOR chỉ nhận ra 37,5%.
3. Điểm yếu? CREATOR hay bị nhầm thành GAMING (14 trên 24 máy), nên có hàng đợi Duyệt nhãn để người sửa.

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

Code: `ml-service/app/data/features.py` — `MODEL_A_FEATURES` (dòng 30), `build_model_a_preprocessor()` (dòng 188).

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

Code: `ml-service/app/models/classifier.py` — `PARAM_GRID` (dòng 21–25), `grid_search()` (dòng 40).

`GridSearchCV` thử **mọi tổ hợp** rồi chọn bộ có macro-F1 cao nhất bằng kiểm thử chéo 5 phần:

| Tham số | Các giá trị thử | Chọn được |
|---|---|---|
| `k` (số láng giềng) | 1, 3, 5, …, 31 (số lẻ để tránh hòa phiếu) | **7** |
| Cách đo khoảng cách | Euclidean (đường thẳng) / Manhattan (đi theo ô phố) | **Euclidean** |
| Trọng số phiếu | `uniform` (mỗi người 1 phiếu) / `distance` (gần thì phiếu nặng) | **uniform** |

**Tổng kết 30 giây (cách đếm phiếu `uniform` / `distance`)**

- **Một câu:** mô hình đếm phiếu của k máy giống nhất để chọn phân khúc; `uniform` = mỗi máy 1 phiếu,
  `distance` = máy càng giống thì phiếu càng nặng; hệ thống thử cả hai lúc huấn luyện và giữ cách điểm
  cao hơn (hiện là `uniform`, k = 7).
- **Luồng:** danh sách cách đếm (`classifier.py:23`) -> huấn luyện thử cả hai, chọn cách điểm cao nhất
  -> lưu vào `model.joblib` -> khi dự đoán, `predict_proba` (`main.py:98`) tự đếm theo cách đã lưu.
- **Cách đọc code:** chỉ 1 dòng do mình chọn (`classifier.py:23`); cách thắng nằm trong `model.joblib`
  (xem bằng `python -m app.lifecycle.inspect_model`); không có hàm đếm phiếu nào tự viết, scikit-learn làm.
- **Lưu ý:** không cần nhớ phép tính; hỏi "sao chọn uniform" thì trả lời "hệ thống tự thử rồi chọn theo
  điểm kiểm thử chéo 0,7938". Model C (TV2) khác: cố định `distance` (`text_classifier.py:128`).
- **Ví dụ khi cần giải thích kỹ:** 7 láng giềng của Predator Helios 0051 (GAMING x4, CREATOR x3):
  `uniform` thắng 4 - 3; `distance` cộng 1/khoảng cách: GAMING 1,945 so với CREATOR 1,400.

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
| Đặc trưng + tiền xử lý | `ml-service/app/data/features.py` |
| Mô hình, GridSearch, baseline, đường cong k | `ml-service/app/models/classifier.py` |
| Huấn luyện + lưu phiên bản | `ml-service/app/lifecycle/train.py`, `ml-service/app/lifecycle/registry.py` |
| Đo lại kiểm thử chéo, ma trận nhầm lẫn | `ml-service/app/lifecycle/evaluate.py`, `ml-service/artifacts/evaluation.json` |
| Endpoint `/predict-segment` | `ml-service/app/main.py` (hàm `predict_segment`, dòng 86–120) |
| Backend: gọi mô hình + quyết định VERIFIED/NEEDS_REVIEW | `backend/src/modules/laptops/segment.service.ts` (`predictSegment` dòng 59; `applySegmentLabel` dòng 104) |
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

## 1.11 Trung bình và độ lệch chuẩn (z-score) lấy ở đâu, kiểm tra thế nào

| Câu hỏi | Trả lời |
|---|---|
| Ai tính? | `StandardScaler` (dòng `("sc", StandardScaler())` ở `ml-service/app/data/features.py`), tự tính lúc **huấn luyện** |
| Tính trên dữ liệu nào? | **800 máy huấn luyện** (80% của 1.000 máy), do `train_test_split(test_size=0.2, stratify, random_state=42)` ở `ml-service/app/lifecycle/train.py` dòng 47; 200 máy còn lại chỉ dùng kiểm tra |
| Lưu ở đâu? | Trong file mô hình `ml-service/artifacts/clf-.../model.joblib`; khi có máy mới, ML dùng đúng 2 con số này, **không tính lại** |
| Công thức? | trung bình = tổng ÷ n; độ lệch chuẩn = √(tổng (x − trung bình)² ÷ n) (chia n, tức `ddof=0`; Excel: `STDEV.P`) |

**Kiểm chứng độc lập (chạy thật):** tính lại trên đúng 800 máy huấn luyện bằng cách khác, ra cùng số với số
mô hình đã lưu:

| Cột | Mô hình lưu sẵn | Tự tính lại trên 800 máy | Tính trên cả 1.000 máy (khác một chút) |
|---|---|---|---|
| `weight_kg` | 1,8325 / 0,5652 | 1,8325 / 0,5652 | 1,8342 / 0,5672 |
| `gpu_score` | 30,9521 / 28,9868 | 30,9521 / 28,9868 | 30,9108 / 28,6739 |

Tự kiểm tra bằng Excel: mở `data/processed/catalog_vn.csv`, cột cân nặng, dùng `AVERAGE` và `STDEV.P` sẽ ra số
gần giống cột "cả 1.000 máy" (khác 800 máy một chút vì mô hình chỉ học trên 800).

**Xem trực tiếp bên trong `model.joblib`:** file này là **nhị phân** (mở bằng VS Code chỉ thấy cảnh báo "binary"),
nên dùng lệnh sau để in ra dạng đọc được. **Phải đứng trong thư mục `ml-service`** (dòng nhắc lệnh phải
là `PS D:\QL_Laptop\ml-service>`); nếu đứng ở `D:\QL_Laptop` sẽ báo lỗi `No module named 'app'`:

```
cd ml-service                                                # bỏ qua nếu đã đứng trong ml-service
python -m app.lifecycle.inspect_model                        # bản đang dùng (ghi trong file artifacts/LATEST)
python -m app.lifecycle.inspect_model clf-2026.09.27-012747  # một bản cụ thể
```
(Trên PowerShell có thể gộp 1 dòng: `cd ml-service; python -m app.lifecycle.inspect_model`.)
Kết quả gồm: trung bình/độ lệch chuẩn của từng cột (bước chuẩn hóa), `k = 7`, cách đo `euclidean`, và
**"số máy đã ghi nhớ = 800"**. Lưu ý kNN không "học công thức", nó **ghi nhớ 800 máy đã gán nhãn** rồi so sánh
máy mới với chúng. Phần chữ dễ đọc (tham số tốt nhất, điểm macro-F1, số mẫu) có sẵn trong
`artifacts/<phiên bản>/metadata.json`. Chú ý: nhiều thư mục phiên bản là các lần huấn luyện cũ; bản đang dùng
là bản ghi trong file `LATEST`.

## 1.13 Tính khoảng cách đủ 11 cột (ví dụ thật, từng bước)

**Máy A** = `Acer Predator Helios 0051` (máy cần đoán, nhãn thật CREATOR, thuộc tập kiểm tra nên không nằm
trong 800 máy mô hình ghi nhớ). **Máy B** = `Gigabyte G5 0276` (láng giềng #1, nhãn CREATOR).
Trung bình/độ lệch chuẩn lấy từ `model.joblib` (lệnh ở `17_...`, nguồn ở mục 1.11). Công thức: `z = (giá trị − trung bình) ÷ độ lệch chuẩn`
(RAM, SSD lấy log₂ trước). Làm tròn 4 chữ số.

**Bước 1: đổi sang z-score cho từng máy**

| Cột | Giá trị gốc A / B | Sau log₂ A / B | Trung bình | Độ lệch chuẩn | z của A = (A − TB) ÷ ĐLC | z của B = (B − TB) ÷ ĐLC |
|---|---|---|---|---|---|---|
| ram_gb | 32 / 16 | 5 / 4 | 3,7938 | 0,7913 | (5 − 3,7938) ÷ 0,7913 = **1,5243** | (4 − 3,7938) ÷ 0,7913 = **0,2606** |
| ssd_gb | 512 / 512 | 9 / 9 | 8,9125 | 0,7809 | (9 − 8,9125) ÷ 0,7809 = **0,1120** | (9 − 8,9125) ÷ 0,7809 = **0,1120** |
| cpu_score | 42,4324 / 40 | giữ nguyên | 48,9933 | 20,5806 | (42,4324 − 48,9933) ÷ 20,5806 = **−0,3188** | (40 − 48,9933) ÷ 20,5806 = **−0,4370** |
| gpu_score | 16,6667 / 27,0833 | giữ nguyên | 30,9521 | 28,9868 | (16,6667 − 30,9521) ÷ 28,9868 = **−0,4928** | (27,0833 − 30,9521) ÷ 28,9868 = **−0,1335** |
| screen_inch | 13,6 / 13,3 | giữ nguyên | 15,3732 | 0,9616 | (13,6 − 15,3732) ÷ 0,9616 = **−1,8442** | (13,3 − 15,3732) ÷ 0,9616 = **−2,1561** |
| ppi | 221,976 / 255,356 | giữ nguyên | 156,7983 | 34,0465 | (221,976 − 156,7983) ÷ 34,0465 = **1,9144** | (255,356 − 156,7983) ÷ 34,0465 = **2,8948** |
| refresh_hz | 120 / 120 | giữ nguyên | 98,7750 | 46,5490 | (120 − 98,775) ÷ 46,549 = **0,4560** | (120 − 98,775) ÷ 46,549 = **0,4560** |
| weight_kg | 1,74 / 2,09 | giữ nguyên | 1,8325 | 0,5652 | (1,74 − 1,8325) ÷ 0,5652 = **−0,1636** | (2,09 − 1,8325) ÷ 0,5652 = **0,4556** |
| battery_wh | 55 / 58 | giữ nguyên | 58,8963 | 14,5795 | (55 − 58,8963) ÷ 14,5795 = **−0,2672** | (58 − 58,8963) ÷ 14,5795 = **−0,0615** |
| gpu_dedicated | 1 / 1 | không chuẩn hóa | không có | không có | giữ nguyên **1** | giữ nguyên **1** |
| srgb_100 | 1 / 1 | không chuẩn hóa | không có | không có | giữ nguyên **1** | giữ nguyên **1** |

**Bước 2: hiệu giữa hai máy rồi bình phương**

| Cột | z của A | z của B | Hiệu = zA − zB | Hiệu² | Chiếm % của tổng |
|---|---|---|---|---|---|
| ram_gb | 1,5243 | 0,2606 | 1,5243 − 0,2606 = **1,2637** | 1,2637² = **1,5969** | 49,5% |
| ssd_gb | 0,1120 | 0,1120 | 0,1120 − 0,1120 = 0,0000 | 0,0000 | 0% |
| cpu_score | −0,3188 | −0,4370 | −0,3188 − (−0,4370) = **0,1182** | 0,1182² = **0,0140** | 0,4% |
| gpu_score | −0,4928 | −0,1335 | −0,4928 − (−0,1335) = **−0,3594** | (−0,3594)² = **0,1291** | 4,0% |
| screen_inch | −1,8442 | −2,1561 | −1,8442 − (−2,1561) = **0,3120** | 0,3120² = **0,0973** | 3,0% |
| ppi | 1,9144 | 2,8948 | 1,9144 − 2,8948 = **−0,9804** | (−0,9804)² = **0,9612** | 29,8% |
| refresh_hz | 0,4560 | 0,4560 | 0,4560 − 0,4560 = 0,0000 | 0,0000 | 0% |
| weight_kg | −0,1636 | 0,4556 | −0,1636 − 0,4556 = **−0,6193** | (−0,6193)² = **0,3835** | 11,9% |
| battery_wh | −0,2672 | −0,0615 | −0,2672 − (−0,0615) = **−0,2058** | (−0,2058)² = **0,0423** | 1,3% |
| gpu_dedicated | 1 | 1 | 0 | 0,0000 | 0% |
| srgb_100 | 1 | 1 | 0 | 0,0000 | 0% |

**Bước 3: cộng và lấy căn**

- Tổng Hiệu² = 1,5969 + 0 + 0,0140 + 0,1291 + 0,0973 + 0,9612 + 0 + 0,3835 + 0,0423 + 0 + 0 = **3,2244**
- Khoảng cách = √3,2244 = **1,7957** (giao diện hiện `#1 · khoảng cách 1.80`)

Nhận xét: A và B giống hệt nhau ở SSD, tần số quét, card rời, màn chuẩn màu (hiệu bằng 0). Khác nhau chủ yếu ở
RAM (32GB so với 16GB), ppi và cân nặng. Số này chỉ là khoảng cách tới **một** máy; kNN làm như vậy với cả 800 máy
rồi lấy 7 số nhỏ nhất.

## 1.14 Thêm dữ liệu huấn luyện bằng Excel (ví dụ thêm 2.000 máy)

Code **không gắn cứng số 1.000 máy**, nên thêm bao nhiêu dòng cũng huấn luyện được (đã mô phỏng 2.000 dòng:
chia 1.600 học / 400 kiểm tra, huấn luyện 27 giây). Điều cần giữ là **định dạng file**.

1. **Sao lưu** `data/processed/catalog_vn.csv` (copy sang tên khác).
2. Mở bằng Excel, thêm dòng bên dưới, **đủ các cột như dòng tiêu đề, không đổi tên/xóa tiêu đề**. Mỗi dòng cần:
   `sku` không trùng; `cpu_model`, `gpu_model` trùng tên trong `cpu_benchmark.csv`, `gpu_benchmark.csv`;
   `resolution` dạng `1920x1080`; `segment` là một trong `OFFICE`, `ULTRABOOK`, `GAMING`, `CREATOR` (viết HOA, không để trống).
3. **Lưu bằng "CSV UTF-8 (Comma delimited)"**. Cảnh báo cho Windows tiếng Việt: Excel có thể lưu bằng dấu `;`
   và số thập phân bằng dấu phẩy (`2,51`), làm file hỏng. Cách tránh: nhập số bằng dấu chấm, hoặc đổi cài đặt
   Windows (Region, Additional settings): Decimal symbol là `.` và List separator là `,`.
4. **Mở file vừa lưu bằng VS Code** kiểm tra: dòng 2 phải ngăn cách bằng dấu phẩy và số dạng `2.51`.
5. Kiểm tra: `cd ml-service`, rồi `python -m app.data.data_check`. File sai định dạng sẽ được báo bằng tiếng Việt
   (thiếu cột, số thập phân dùng dấu phẩy, nhãn `segment` lạ). Dòng "Cột thiếu quá 10%: original_price_vnd" là cảnh báo có sẵn.
6. Huấn luyện: nút "Huấn luyện mô hình mới" (hoặc `python -m app.lifecycle.train`), mất khoảng nửa phút. Bản mới là **Ứng viên**.
7. So điểm với bản đang dùng rồi "Đưa vào sử dụng".

Lưu ý: (a) chạy lại `data/generate_catalog.py` sẽ **ghi đè** file CSV, mất dòng thêm tay; (b) mỗi lần huấn luyện chia
tập kiểm tra khác nhau nên điểm macro-F1 giữa các bản chỉ so sánh tương đối; (c) thêm dòng **sao chép** không làm
mô hình tốt hơn (chỉ dữ liệu thật mới có ích); (d) CSV chỉ phục vụ huấn luyện, muốn máy hiện trên web phải nhập
vào SQL (trang Quản trị Laptop hoặc `npm run seed`); (e) Mô hình B không huấn luyện, nó tự cập nhật khi backend đồng bộ catalog.

## 1.12 Kịch bản DEMO trên ứng dụng (đã thử thật trên app)

Điều kiện: 3 dịch vụ đang chạy (shortcut Desktop `SmartLap`), đăng nhập quản trị `admin@smartlap.vn` / `Demo@123`.

**Demo 1 — "AI gợi ý phân khúc", trường hợp CHẮC CHẮN (7/7 phiếu)**
1. Menu trái: **Dữ liệu → Laptop**. Gõ `TUF Gaming 0001` vào ô Tìm kiếm.
2. Bấm **Sửa** ở dòng `ASUS TUF Gaming 0001`.
3. Trong form bấm nút **"AI gợi ý phân khúc từ cấu hình"**.
4. Kết quả mong đợi: `Dự đoán: Gaming 100%`; "7 máy gần nhất ... đã bỏ phiếu: 7 Gaming"; khoảng cách `0.00 (chính nó), 1.79, 1.83, 1.99, 2.12, 2.14, 2.24`.
5. Bấm **Hủy** (không lưu gì). *Lời nói gợi ý:* "7 máy giống nhất đều là Gaming nên AI chắc chắn 100%".

**Demo 2 — trường hợp RANH GIỚI (cần xác minh)**
1. Cũng ở trang Laptop, tìm `Predator Helios 0051`, bấm **Sửa**, bấm nút AI như trên.
2. Kết quả mong đợi: xác suất `Văn phòng 14% / Mỏng nhẹ 43% / Gaming 0% / Đồ họa 43%`; "3 Đồ họa, 3 Mỏng nhẹ, 1 Văn phòng"; khoảng cách `1.80 ... 2.29`; nhãn **"Cần xác minh"** và dòng cảnh báo "Hệ thống chưa chắc chắn".
3. Bấm **Hủy**. *Lời nói gợi ý:* "hai nhóm hòa phiếu 3-3 nên độ tin cậy chỉ 43%, dưới ngưỡng 60%, máy sẽ vào hàng đợi cho người xác nhận". (Khi hòa phiếu giao diện hiện nhãn đứng sau là Mỏng nhẹ; không sao, đó là hòa.)

**Demo 3 — để trống phân khúc, AI tự gán khi Lưu**
1. Laptop → **+ Thêm mới**, điền thông số (CPU `Intel Core i9-13900H`, GPU `RTX 4070`, RAM 32, SSD 1024, màn 16", 240 Hz, nặng 2,6 kg, giá 45 triệu, SKU bất kỳ), **để trống ô Phân khúc** (có nút xóa nếu đã lỡ chọn).
2. Bấm **Lưu**. Mong đợi thông báo "Đã gán phân khúc: Gaming"; hàng mới có cột Phân khúc là Gaming.
3. **Xóa máy thử** sau khi demo (nút Xóa ở dòng đó).

**Demo 4 — hàng đợi "Duyệt nhãn"**: menu **Dữ liệu → Duyệt nhãn** (có huy hiệu số máy đang chờ). Mỗi thẻ hiện
phân bố xác suất, ô chọn phân khúc, checkbox "Khóa nhãn, không cho mô hình thay đổi", nút Duyệt.

---

# PHẦN 2 — Thành viên 2: Mô hình C (hiểu câu tự do, TF-IDF + kNN cosine)

*(Sẽ bổ sung khi nhóm học xong. Code: `ml-service/app/models/text_classifier.py`; giao diện: ô nhập câu ở Wizard.)*

# PHẦN 3 — Thành viên 3: Mô hình B (xếp hạng top-5, kNN khoảng cách một phía)

*(Sẽ bổ sung khi nhóm học xong. Code: `ml-service/app/models/retriever.py`, `ml-service/app/models/explain.py`; giao diện: trang Kết quả + "Vì sao gợi ý?".)*
