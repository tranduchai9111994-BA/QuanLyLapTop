# 20 — Mô hình A đi sâu vào bản chất (từ tổng quan đến chi tiết)

> **Mục đích:** hiểu *vì sao* Mô hình A chạy như vậy, không chỉ *nó chạy thế nào*. Đọc từ trên xuống: mỗi
> mục là một "lớp" đi sâu hơn mục trước. Mọi con số trong file này đều lấy từ mô hình thật
> `ml-service/artifacts/clf-2026.09.27-160831` (bản đang dùng, file `LATEST`) hoặc từ các lần chạy
> thử ghi rõ ở từng chỗ.
>
> **Lưu ý về số "800 học / 200 thi":** dữ liệu đọc từ `data/processed/catalog_vn.csv` (hiện **1.000 máy mẫu**), code
> chia theo **tỷ lệ 80/20** (`test_size=0.2`), không viết cứng 800. Các số 800/200/640/160 trong file này là giá trị
> **hiện tại**; đổi số dòng CSV rồi huấn luyện lại thì các số này đổi theo.
>
> Các file liên quan: [04](04_MO_HINH_KNN.md) (đặc tả), [13](13_GIAI_THICH_THUAT_TOAN_KNN.md) (giải thích
> kNN), [14](14_KET_QUA_THUC_NGHIEM.md) (kết quả), [19](19_BAI_TRINH_BAY_MO_HINH_A.md) (bài trình bày).

---

## 0. Bức tranh một trang

```
 Máy laptop (11 con số)                                   Phân khúc
 ram, ssd, cpu, gpu, ...  ──►  [TIỀN XỬ LÝ] ──►  [kNN]  ──►  GAMING / OFFICE / ULTRABOOK / CREATOR
                               đưa về cùng thước đo   │
                                                      ├─ Đo "gần" thế nào?     → metric  (euclidean)
                                                      ├─ Hỏi mấy người?         → k       (7)
                                                      └─ Phiếu tính ra sao?     → weights (uniform)
```

Một câu để nhớ: **kNN là thuật toán; còn tiền xử lý, metric, k, weights là các *lựa chọn cách làm*
quanh thuật toán đó.** Đổi lựa chọn thì kết quả đổi, còn thuật toán vẫn là kNN.

> **Vì sao dùng kNN mà không phải cây quyết định, rừng ngẫu nhiên...?** Lý do chọn và so sánh với cách làm khác nằm ở
> [file 13, mục 2](13_GIAI_THICH_THUAT_TOAN_KNN.md); file này không lặp lại mà tập trung vào *kNN chạy bằng gì bên trong*.

| Tầng | Câu hỏi nó trả lời | Trong code | Giá trị đang dùng |
|---|---|---|---|
| 1. Thuật toán | "Đoán nhãn bằng cách nào?" | `KNeighborsClassifier` — [classifier.py:35](../ml-service/app/models/classifier.py) | kNN: hỏi hàng xóm |
| 2. Tiền xử lý | "11 con số có cùng thước đo chưa?" | `build_model_a_preprocessor` — [features.py:187](../ml-service/app/data/features.py) | log2 + z-score |
| 3. Metric | "Hai máy cách nhau bao xa?" | `knn__metric` | euclidean |
| 4. k | "Hỏi bao nhiêu hàng xóm?" | `knn__n_neighbors` | 7 |
| 5. weights | "Mỗi hàng xóm được mấy phiếu?" | `knn__weights` | uniform (1 phiếu/người) |
| 6. Cách chọn 3-5 | "Chọn giá trị tầng 3-5 bằng gì?" | `GridSearchCV` — [classifier.py:43](../ml-service/app/models/classifier.py) | thử 64 tổ hợp |

---

## 1. Bản chất của kNN: nó "học" bằng cách… không học gì

Hầu hết thuật toán ML (hồi quy, cây quyết định, mạng nơ-ron) khi **huấn luyện** sẽ rút ra một
*công thức/luật* rồi vứt dữ liệu đi. kNN thì ngược lại:

- **Huấn luyện (`fit`)** = chỉ **cất 800 máy** (đã chuẩn hóa) vào bộ nhớ. Không rút công thức gì cả.
  Vì vậy kNN gọi là *lazy learner* (học lười).
- **Dự đoán (`predict`)** = lúc có máy mới mới làm việc: đo khoảng cách đến **cả 800 máy**, lấy k máy
  gần nhất, bỏ phiếu.

Hệ quả cần nhớ:
1. File `model.joblib` thực chất chứa **800 máy + bộ chuẩn hóa + 3 lựa chọn (k, metric, weights)**.
2. "Mô hình" không có *tham số học được* kiểu hệ số. Thứ duy nhất nhà thiết kế **phải chọn** là các
   **siêu tham số** (k, metric, weights). Đó là lý do cả file này xoay quanh việc chọn chúng.
3. Dự đoán chậm dần khi dữ liệu nhiều lên (phải so với tất cả máy) — xem mục 7.5.

> **`MODEL_A_FEATURES` có lấy từ `model.joblib` không? KHÔNG.** Nó là danh sách **11 tên cột** viết cứng trong code
> ([features.py:29](../ml-service/app/data/features.py): `MODEL_A_FEATURES = NUMERIC_LOG + NUMERIC + BINARY` = 2+7+2),
> chỉ là chuỗi chữ, không chứa số liệu. Code dùng nó để **chọn đúng 11 cột** từ bảng máy (`X[MODEL_A_FEATURES]`) trước
> khi đưa vào mô hình. Còn `model.joblib` giữ **số học được**:
>
> | Thứ | Nằm ở | Ví dụ |
> |---|---|---|
> | Tên 11 cột | **code** `features.py` | `"ram_gb"`, `"cpu_score"`... |
> | Số học từ 800 máy | **`model.joblib`** | trung vị, trung bình, độ lệch chuẩn từng cột; 800 máy đã chuẩn hóa; k=7, euclidean, uniform |
> | Bản sao tên 11 cột để tra cứu | `metadata.json` (`feature_list`) | chỉ để ghi lại cho người xem |
>
> Lúc dự đoán hai thứ ghép lại: code chọn 11 cột theo tên → pipeline trong `model.joblib` chuẩn hóa bằng số đã lưu.
> **Hệ quả:** sửa `MODEL_A_FEATURES` (thêm/bớt cột) mà không huấn luyện lại thì `model.joblib` cũ vẫn nhớ bộ cột cũ →
> dự đoán lỗi/sai. Đổi cột phải chạy lại `python -m app.lifecycle.train`.

> **Pipeline là gì?** *Pipeline* = **đường ống / dây chuyền**: dữ liệu vào đầu dây chuyền, đi qua từng công đoạn
> theo thứ tự, ra thành phẩm ở cuối. Dây chuyền của Mô hình A ([classifier.py:35](../ml-service/app/models/classifier.py)):
>
> ```
> máy (11 số thô) ──► [prep: điền thiếu → log2 → z-score] ──► [knn: tìm 7 hàng xóm, bỏ phiếu] ──► phân khúc
>                        công đoạn 1                              công đoạn 2
> ```
> ```python
> Pipeline([("prep", build_model_a_preprocessor()), ("knn", KNeighborsClassifier())])
> ```
> Vì sao gom thành một dây chuyền thay vì làm rời từng bước:
> 1. **Không quên bước, không đảo thứ tự:** `pipeline.predict(máy)` tự chạy đủ công đoạn 1 rồi 2. Làm rời mà quên
>    chuẩn hóa thì kNN đo trên số thô → sai.
> 2. **Chống rò rỉ dữ liệu (quan trọng nhất):** trong kiểm thử chéo (640 máy học / 160 máy chấm), pipeline tự **tính lại
>    trung bình và độ lệch chuẩn chỉ trên 640 máy học** rồi áp cho 160 máy chấm. Chuẩn hóa ngoài pipeline trên cả 800
>    máy thì 160 máy chấm đã "nhìn lén" → điểm cao ảo. Quy ước `CLAUDE.md`: *không bao giờ fit scaler ngoài pipeline*.
> 3. **Lưu và nạp một cục:** `model.joblib` là cả dây chuyền (bộ chuẩn hóa + số đã học + kNN), nạp lên dùng được ngay.
>
> Hiểu gần như hàm gọi nối tiếp `knn(prep(máy))`, nhưng đóng gói thành một thứ có `fit` (học) và `predict` (dự đoán) chung.

> **Tham số vs siêu tham số.** *Tham số* là thứ máy tự học từ dữ liệu (ở kNN: gần như không có, trừ
> trung bình/độ lệch chuẩn của bộ chuẩn hóa). *Siêu tham số* là thứ **người đặt trước khi học**
> (k, metric, weights); máy không tự suy ra được, phải **thử nhiều giá trị rồi so điểm** — việc của mục 7.

---

## 2. Tiền xử lý: vì sao phải làm TRƯỚC khi đo khoảng cách

kNN chỉ biết một việc: *"hai máy cách nhau bao nhiêu"*. Khoảng cách cộng dồn **chênh lệch của mọi
cột**. Nếu cột nào có số to thì nó **nuốt** các cột còn lại.

Ví dụ thật (máy #0 và máy #560 trong catalog, cùng là GAMING):

| Cột | Máy #0 | Máy #560 | Chênh lệch **thô** |
|---|---|---|---|
| `ssd_gb` | 256 | 256 | 0 |
| `ppi` | 127,3 | 136,8 | 9,5 |
| `gpu_score` | 52,1 | 39,6 | 12,5 |
| `screen_inch` | 17,3 | 16,1 | **1,2** |
| `srgb_100` (0/1) | 1 | 0 | **1** |

Nếu đo trên số thô, chênh `gpu_score` (12,5) lớn gấp ~10 lần chênh `screen_inch` (1,2) **chỉ vì đơn vị**,
không phải vì GPU quan trọng hơn màn hình. Chuẩn hóa là để mọi cột nói cùng một "ngôn ngữ".

Code chia 11 cột thành 3 nhóm ([features.py:187](../ml-service/app/data/features.py)):

| Nhóm | Cột | Xử lý | Vì sao |
|---|---|---|---|
| 1 (2 cột) | `ram_gb`, `ssd_gb` | điền thiếu bằng trung vị → **log2** → z-score | RAM 8→16 và 16→32 đều là "gấp đôi", phải cách đều nhau. log2: 8→3, 16→4, 32→5 |
| 2 (7 cột) | `cpu_score`, `gpu_score`, `screen_inch`, `ppi`, `refresh_hz`, `weight_kg`, `battery_wh` | điền thiếu → **z-score** | đưa về cùng thước |
| 3 (2 cột) | `gpu_dedicated`, `srgb_100` | giữ nguyên 0/1 | đã là thang 0–1 |

**Điền thiếu bằng trung vị là gì?** *Điền thiếu* (`SimpleImputer`, [features.py:187](../ml-service/app/data/features.py)):
máy nào có **ô trống** ở một cột thì điền tạm một số, vì kNN không đo được khoảng cách khi có ô trống.
*Trung vị* là số **đứng giữa** khi xếp các giá trị từ nhỏ đến lớn; khác trung bình ở chỗ không bị vài máy
cực đoan kéo lệch.
- Ví dụ RAM của 5 máy: 8, 16, 16, 32 và một máy trống. Trung vị của 4 giá trị có sẵn = **16** → máy trống được
  điền 16. Trung bình là 18; nếu có thêm một máy 128 GB thì trung bình vọt lên còn trung vị gần như không đổi.
- Trung vị **tính trên 800 máy học**, mỗi cột một số, lưu trong `model.joblib`; máy mới nhập thiếu cột được điền
  đúng số đó (không dùng 200 máy thi → không rò rỉ dữ liệu). Điền xong mới đến log2 / z-score.
- **Hiện tại 1.000 máy không có ô trống nào ở 11 cột** (đã kiểm tra). Ô thiếu đã được xử lý trước ở
  `enrich_catalog`: `refresh_hz` thiếu → 60; `battery_wh` thiếu → trung vị cùng phân khúc. Nên bước `impute` ở
  pipeline hiện chỉ là **lưới an toàn** cho máy mới nhập thiếu cột. Trung vị toàn catalog: RAM 16 GB, SSD 512 GB.

**z-score** = `(x − trung bình) / độ lệch chuẩn`. Nghĩa: "máy này cao/thấp hơn mức trung bình bao nhiêu
*lần độ lệch chuẩn*". Sau bước này mọi cột có trung bình 0 và độ lệch chuẩn 1.

Điểm tinh tế: trung bình và độ lệch chuẩn **chỉ tính trên 800 máy học** rồi lưu trong `model.joblib`; máy
mới (và 200 máy thi) được chuẩn hóa bằng **chính các số đó**. Nhờ vậy không "nhìn lén" dữ liệu thi
(*rò rỉ dữ liệu*). Bộ chuẩn hóa nằm **trong Pipeline** ([classifier.py:35](../ml-service/app/models/classifier.py))
để mỗi phần của kiểm thử chéo cũng tự tính lại trên phần học của nó.

Kết quả sau chuẩn hóa của đúng hai máy ở trên (11 cột, thứ tự `MODEL_A_FEATURES`):

```
Máy #0  : [-1.00, -1.17, -0.12, 0.73, 2.00, -0.87, 0.97, 1.20, 0.76, 1, 1]
Máy #560: [-1.00, -1.17, -0.12, 0.30, 0.76, -0.59, 0.97, 0.69, 1.10, 1, 0]
```

Giờ `screen_inch` chênh 1,25 còn `gpu_score` chênh 0,43 — công bằng hơn nhiều.

---

## 3. Metric: "gần" nghĩa là gì (Euclidean vs Manhattan)

Sau chuẩn hóa mỗi máy là **một điểm trong không gian 11 chiều**. Metric là *cây thước* đo giữa hai điểm.

Dùng đúng hai vector ở mục 2, tính từng bước (`d` = hiệu từng cột):

```
d = [0, 0, 0, 0.43, 1.25, -0.28, 0, 0.51, -0.34, 0, 1]
```

**Euclidean** (đường thẳng chim bay, Pytago): `√(Σ d²)`
```
d²   = [0, 0, 0, 0.19, 1.56, 0.08, 0, 0.26, 0.12, 0, 1.00]
Σ d² = 3.20      →  √3.20 = 1.789
```

**Manhattan** (đi theo lưới phố, cộng độ lệch từng cột): `Σ |d|`
```
|d|  = [0, 0, 0, 0.43, 1.25, 0.28, 0, 0.51, 0.34, 0, 1.00]
Σ|d| = 3.81
```

(Số này khớp với máy chạy thật: euclid 1,789; manhattan 3,814 — sai khác nhỏ là do làm tròn từng cột.)

**Khác nhau ở bản chất:** bình phương **phóng đại chênh lệch lớn**. Cột `screen_inch` chênh 1,25 đóng góp
1,56 vào tổng Euclid (đến ~49%), nhưng chỉ 1,25 vào tổng Manhattan (~33%). Nên:
- **Euclidean** phạt nặng máy "lệch hẳn ở một cột" → nhạy với giá trị cực đoan.
- **Manhattan** đối xử đều tay hơn → bền hơn khi có ngoại lệ.

Cả hai đều là "thước đo", không phải "thuật toán": thay `euclidean` bằng `manhattan` chỉ đổi *dòng tính
khoảng cách*, kNN vẫn là kNN. Kết quả đo thật (kiểm thử chéo 5 phần trên 800 máy, k = 7, macro-F1):

| metric | uniform | distance |
|---|---|---|
| euclidean | **0,7938** | 0,7920 |
| manhattan | 0,7855 | 0,7812 |

Euclidean hơn ~0,01. Chênh nhỏ so với độ dao động giữa các phần (±0,046, mục 6), nên **không thể nói
chắc Euclid "thắng"**; chỉ có thể nói nó nhỉnh hơn một chút nên được chọn. Đó cũng là cách trả lời hội
đồng trung thực nhất.

### 3.1 Mỗi cột đóng góp bao nhiêu vào khoảng cách

Sau chuẩn hóa **mọi cột có quyền ngang nhau**: kNN không biết cột nào "quan trọng" hơn. Nhìn lại ví dụ ở trên
(tổng hiệu² = 3,20):

| Cột | hiệu² | Phần trong tổng |
|---|---|---|
| `screen_inch` | 1,56 | **~49%** |
| `srgb_100` (khác nhau 0/1) | 1,00 | **~31%** |
| `weight_kg` | 0,26 | ~8% |
| `gpu_score` | 0,19 | ~6% |
| các cột còn lại | 0,19 | ~6% |

Hai máy giống nhau ở 8 cột, chỉ **một cột nhị phân khác nhau** (`srgb_100`) đã chiếm gần một phần ba khoảng cách. Hệ quả:
- Cột nhị phân khác nhau tạo "bước nhảy" bằng đúng 1 (cỡ một độ lệch chuẩn), nên không bị bỏ qua.
- Hai cột có thể **nói cùng một chuyện** (ví dụ `screen_inch` và `ppi`) sẽ bị tính hai lần; tôi chưa đo mức tương quan này.

Số đo thật về độ quan trọng của từng thứ (chạy `run_ablation` trong `ablation.py` trên 800 máy học, k=7, uniform,
euclidean, kiểm thử chéo 5 phần, macro-F1; chạy lại cho bài này, không ghi file):

| Biến thể | macro-F1 | So với đầy đủ |
|---|---|---|
| Đầy đủ (baseline) | 0,7938 | — |
| Bỏ bước chuẩn hóa | 0,7387 | −0,055 |
| Bỏ cột `refresh_hz` | 0,7267 | −0,067 |
| Bỏ cột `srgb_100` | 0,7583 | −0,036 |

Đọc đúng: **chuẩn hóa có ích** (mất 0,055), và bỏ `refresh_hz` hay `srgb_100` đều làm điểm giảm, tức hai cột này mang thông tin thật.
Độ dao động là ±0,02–0,05 nên mức giảm 0,036 của `srgb_100` chỉ ở ngưỡng sát; mức giảm của `refresh_hz` và chuẩn hóa rõ hơn.

### 3.2 Đổi thước đo Euclid ↔ Manhattan bằng cách nào

Không có dòng nào "đặt" Euclid: `metric` nằm trong lưới thử `PARAM_GRID` ([classifier.py:31](../ml-service/app/models/classifier.py))
và `GridSearchCV` chọn Euclid vì điểm cao hơn. Muốn đổi phải **ép** lưới chỉ còn một giá trị rồi huấn luyện lại (kNN chốt
thước đo lúc `fit`, sửa trên mô hình đã nạp không an toàn):

1. Sửa `"knn__metric": ["manhattan"]` (hoặc `["euclidean"]` để quay lại) trong `PARAM_GRID`.
2. Chạy lại (PowerShell): `cd D:\QL_Laptop\ml-service` rồi `python -m app.lifecycle.train`. Mỗi lần ra một thư mục phiên bản mới
   và **không** tự đổi `LATEST` (quyết định D-08).
3. Bấm **"Đưa vào sử dụng"** trên giao diện (gọi `POST /models/{version}/activate`, [main.py:232](../ml-service/app/main.py)).

Giao diện tự đổi theo: cửa sổ Chi tiết đọc `explain.model.metric` và chuyển sang công thức `|hiệu|`, không cần sửa FE.
Mô hình B (`retriever.py` dùng `euclidean` cứng) và Mô hình C (`cosine`) **không** đổi theo. Nếu chỉ muốn thử, dùng
`python -m app.lifecycle.ablation` rồi **khôi phục** `PARAM_GRID` để lần huấn luyện sau lại chọn công bằng.

---

## 4. Weights: mỗi láng giềng được mấy phiếu

Sau khi tìm k máy gần nhất còn phải **đếm phiếu**:

`uniform` và `distance` là **hai cách đếm phiếu** của cùng k láng giềng. Thuật toán kNN không đổi, chỉ khác
"mỗi láng giềng được mấy phiếu":

| | `uniform` | `distance` |
|---|---|---|
| Phiếu mỗi láng giềng | **1 phiếu** (ai cũng bằng nhau) | **1 / khoảng cách** (gần → trọng số cao, xa → trọng số thấp) |
| Cách ra kết quả | đếm số người mỗi nhãn | cộng trọng số từng nhãn |
| Ý tưởng | "mỗi hàng xóm một tiếng nói" | "hàng xóm ở gần hơn thì phiếu có trọng số cao hơn" |

- `uniform`: mỗi láng giềng **1 phiếu**, phe nhiều phiếu thắng.
- `distance`: phiếu = **1 / khoảng cách** → người ở gần có phiếu trọng số cao hơn người ở xa.

Giống Euclid/Manhattan: `GridSearchCV` **thử cả hai** rồi chọn cách điểm cao hơn (không phải người đặt tay). Trên giao
diện, bảng bỏ phiếu ở cửa sổ Chi tiết tự tính theo cách này (`voteWeights`,
[SegmentMathModal.tsx:68](../frontend/src/components/admin/SegmentMathModal.tsx)).

Ví dụ thật: máy thi số 28 (thuộc 200 máy giữ riêng, nhãn đúng **OFFICE**), 7 láng giềng:

| Hạng | Nhãn | Khoảng cách | Phiếu `distance` (1/d) |
|---|---|---|---|
| 1 | ULTRABOOK | 0,65 | 1,54 |
| 2 | ULTRABOOK | 0,70 | 1,43 |
| 3 | OFFICE | 1,17 | 0,85 |
| 4 | OFFICE | 1,17 | 0,85 |
| 5 | OFFICE | 1,18 | 0,85 |
| 6 | OFFICE | 1,23 | 0,81 |
| 7 | ULTRABOOK | 1,25 | 0,80 |

- `uniform`: OFFICE 4 phiếu, ULTRABOOK 3 phiếu → **OFFICE** ✅ (đúng).
- `distance`: ULTRABOOK ≈ 1,54+1,43+0,80 = 3,78; OFFICE ≈ 0,85×3+0,81 = 3,36 → **ULTRABOOK** ❌ (sai).

(Cộng lại từ số khoảng cách đã làm tròn nên lệch vài phần trăm so với số máy in; kết luận không đổi.)

Tức là hai kiểu bỏ phiếu **có thể cho nhãn khác nhau trên cùng 7 láng giềng**. Với dữ liệu này
`uniform` nhỉnh hơn (0,7938 vs 0,7920) — chênh không đáng kể (nằm trong độ dao động ±0,046), mô hình chọn `uniform`
vì điểm cao hơn một chút, không phải vì chứng minh được nó hơn hẳn.

---

## 5. k: hỏi bao nhiêu hàng xóm — đánh đổi cốt lõi của kNN

| k | Trạng thái | Ví von |
|---|---|---|
| nhỏ (1) | **Quá khớp (overfit)**: nghe đúng 1 người; một máy gán nhãn lạ làm sai luôn | hỏi một người hàng xóm, người đó nói bậy là sai |
| vừa (7) | cân bằng | hỏi 7 nhà, đa số đúng |
| lớn (31) | **Quá mờ (underfit)**: gom cả những máy chẳng còn giống nữa; lớp nhỏ bị lớp đông **át phiếu** | hỏi cả khu phố, ý kiến nhóm đông luôn thắng |

Dữ liệu có lớp CREATOR chỉ 12% (120/1000; còn khoảng 96 máy trong 800 máy học). Khi k lớn, CREATOR
rất khó thắng vì hàng xóm quanh nó lẫn nhiều GAMING/OFFICE — đó là lý do điểm tụt ở k lớn.

Đường cong đo thật (`metadata.json → k_curve`, kiểm thử chéo 5 phần, uniform + euclidean):

| k | 1 | 3 | 5 | **7** | 9 | 11 | 15 | 19 | 23 | 27 | 31 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| macro-F1 | 0,757 | 0,765 | 0,758 | **0,794** | 0,784 | 0,777 | 0,772 | 0,763 | 0,745 | 0,724 | 0,697 |

Hình dạng "đồi": tăng đến k=7 rồi giảm dần. Điểm nên hiểu cho đúng:
- Đỉnh **không sắc**: k=9 chỉ kém 0,01, độ dao động ±0,03–0,05. Phân biệt k=7 với 9, 11 không chắc chắn.
- Phần đáng tin: **k=1 và k ≥ 21 rõ ràng tệ hơn** (kết luận "k lớn quá thì kém" là chắc).
- k **lẻ** để hạn chế hòa phiếu khi chỉ có 2 nhóm; với 4 phân khúc vẫn có thể hòa (vd 3-3-1), khi đó
  scikit-learn lấy nhãn xếp trước theo thứ tự chữ cái — một chi tiết nhỏ nên biết.

---

## 6. Chọn đúng bộ (k, metric, weights) bằng cách nào — và vì sao phải "kiểm thử chéo"

Cách "ngây thơ": thử mọi giá trị, xem cái nào điểm cao nhất **trên chính 800 máy học**. Sai, vì kNN với
k=1 luôn đúng 100% trên dữ liệu đã học (mỗi máy gần chính nó nhất) → điểm cao ảo.

Code làm đúng ([classifier.py:43](../ml-service/app/models/classifier.py), `grid_search`):

1. **Chia 80/20 trước tiên** ([train.py:83](../ml-service/app/lifecycle/train.py), `train_test_split`): 800 máy
   để học, 200 máy **cất đi, không đụng** đến lúc chấm cuối. `stratify=y` giữ tỷ lệ 4 phân khúc ở cả hai phần.
2. Trên 800 máy học, **kiểm thử chéo 5 phần (`StratifiedKFold(5)`)**: chia 800 thành 5 phần ×160;
   lần lượt dùng 4 phần (640 máy) để học và 1 phần (160 máy) để chấm; lấy điểm trung bình.
3. Làm vậy cho **cả 64 tổ hợp** = 16 giá trị k × 2 weights × 2 metric → 64 × 5 = **320 lần học**.
4. Tổ hợp **macro-F1 trung bình cao nhất** thắng → học lại trên cả 800 máy → lưu `model.joblib`.
5. Cuối cùng mới chấm **một lần** trên 200 máy cất đi: macro-F1 test = **0,787** (CV = 0,794 ± 0,046).

**Vì sao macro-F1 mà không phải accuracy?** Dữ liệu lệch lớp (CREATOR 12%). Accuracy trộn mọi máy lại
nên lớp nhỏ sai nhiều mà điểm vẫn cao. Macro-F1 = trung bình cộng F1 của 4 lớp, **mỗi lớp nặng bằng
nhau** → lớp nhỏ không thể bị bỏ qua.

### 6.1 Vì sao lưới chỉ có 2 giá trị cho metric và weights

Tài liệu nhóm **không ghi lý do** chọn đúng hai giá trị; phần này là lý giải từ cách thư viện hoạt động:
- **`weights`**: `KNeighborsClassifier` chỉ có sẵn **hai** kiểu là `uniform` và `distance`. Cách thứ ba (ví dụ 1/d²) phải tự viết hàm riêng.
- **`metric`**: thư viện có nhiều thước (Euclid, Manhattan, Chebyshev, Minkowski, Cosine...). Nhóm chọn hai thước chuẩn cho **dữ liệu số đã chuẩn hóa**.
  Cosine hợp văn bản TF-IDF (Mô hình C) hơn là 11 cột kích thước máy.
- **Không chỉ 1** vì giả định "một giá trị tốt nhất" mà chưa kiểm chứng; thử thêm gần như không tốn. **Không nhiều hơn 2** vì lưới càng
  lớn càng dễ **chọn trúng nhiễu** khi chênh lệch vốn nhỏ hơn độ dao động.
- Cần nói thật khi bị hỏi: chưa thử Chebyshev hay Cosine cho Mô hình A; thêm một giá trị vào lưới là xong.

### 6.2 F1 là gì, vì sao tên là "F1"

Để chấm một lớp (ví dụ CREATOR) dùng hai câu hỏi ngược chiều nhau:
- **Precision (độ chính xác khi đoán)**: máy được đoán là CREATOR thì bao nhiêu % thật sự là CREATOR?
- **Recall (độ bao phủ)**: trong các máy thật sự là CREATOR, hệ thống tìm ra bao nhiêu %?

F1 gộp hai số này thành một bằng **trung bình điều hòa**: `F1 = 2 × P × R / (P + R)`.
Với CREATOR trên 200 máy thi: P = 0,75, R = 0,375 → F1 = 2×0,75×0,375/(0,75+0,375) = **0,50**. (Trung bình cộng sẽ là 0,5625; trung bình
điều hòa **kéo về phía số thấp** nên không che được điểm yếu.)

**Vì sao gọi là "F1":** đây là **thuật ngữ**, không phải tên chữ thường. Nó là trường hợp β = 1 của họ `Fβ` (F-measure / F-score) do van Rijsbergen
đưa vào lĩnh vực truy hồi thông tin (1979); β cho biết recall quan trọng gấp mấy lần precision. **F1 = β bằng 1: hai thứ ngang nhau**
(F2 coi recall nặng gấp đôi). Chữ "F" là ký hiệu của hàm trong công thức, không có nghĩa tiếng Anh chắc chắn nên đừng nói chắc nó viết tắt cho từ nào.

**Macro-F1** = lấy F1 của **từng lớp** rồi cộng trung bình, mỗi lớp một phần như nhau:
CREATOR 0,500, GAMING 0,869, OFFICE 0,909, ULTRABOOK 0,868 → (0,500+0,869+0,909+0,868)/4 = **0,787** (khớp macro-F1 test).

### 6.3 Mô hình có đáng dùng không: hai mốc so sánh

Điểm 0,787 chỉ có ý nghĩa khi đặt cạnh các cách đơn giản hơn (cùng 200 máy thi):

| Cách | macro-F1 | Ghi chú |
|---|---|---|
| Đoán lớp đông nhất (`DummyClassifier`) | **0,128** | không dùng thông tin máy |
| Luật if-else viết tay (`rule_based_baseline`) | **0,632** | GPU rời + 120Hz → GAMING, màn chuẩn màu + CPU mạnh → CREATOR, nhẹ → ULTRABOOK, còn lại OFFICE |
| **kNN (Mô hình A)** | **0,787** | hơn dummy +0,659; hơn luật +0,155 |

Mục tiêu nhóm đặt: hơn luật ít nhất 0,05 → đạt (0,155). Nếu kNN không thắng được luật tự viết thì không đáng dùng ML.

### 6.4 Điểm yếu thật: lớp CREATOR

Ma trận nhầm lẫn trên 200 máy thi (hàng = nhãn thật, cột = hệ thống đoán):

| Thật \ Đoán | CREATOR | GAMING | OFFICE | ULTRABOOK | Recall |
|---|---|---|---|---|---|
| CREATOR (24 máy) | **9** | 14 | 1 | 0 | **0,375** |
| GAMING (67) | 3 | **63** | 1 | 0 | 0,940 |
| OFFICE (69) | 0 | 1 | **65** | 3 | 0,942 |
| ULTRABOOK (40) | 0 | 0 | 7 | **33** | 0,825 |

Trong 24 máy CREATOR chỉ đoán trúng 9; **14 máy bị đoán nhầm thành GAMING**. Ba lớp kia đều từ 0,83 trở lên. Điểm 0,787 trung bình che mất điều này;
macro-F1 (mỗi lớp 25%) làm lộ ra điều mà accuracy không thấy.

Nguyên nhân khả dĩ (là **giả thuyết**, chưa kiểm chứng riêng): CREATOR chỉ ~96 máy học (12%) và cấu hình giống GAMING (GPU mạnh, màn chuẩn màu),
nên hàng xóm quanh một máy CREATOR hay có nhiều GAMING; khớp với việc k lớn làm lớp nhỏ thiệt ở mục 5.
Cần nói trước với hội đồng: mô hình **tốt ở ba lớp đông, yếu ở CREATOR**, và hướng cải thiện là thêm máy CREATOR hoặc đặc trưng phân biệt CREATOR/GAMING.

---

## 7. Câu hỏi của bạn: dữ liệu tăng từ 800 → 8000 thì k có tăng không?

### 7.1 Đính chính quan trọng: "code fix k = 7" — không đúng với Mô hình A

Trong Mô hình A, **k không bị cố định**. k=7 là **kết quả** của bước chọn ở mục 6, không phải hằng số
trong code. Các chỗ số 7 xuất hiện trong code (đã tìm trong `ml-service/app`):

| Chỗ | Là gì | Có ảnh hưởng đến dự đoán phân khúc không? |
|---|---|---|
| [classifier.py:29](../ml-service/app/models/classifier.py) `range(1, 32, 2)` | **Lưới thử** k = 1…31 | Có — đây là chỗ *chọn* k |
| `model.joblib` → `knn.n_neighbors = 7` | k đã chọn, được lưu theo từng phiên bản | **Có** — dự đoán đọc k từ file này |
| [split_ratio.py:32](../ml-service/app/lifecycle/split_ratio.py) `n_neighbors=7` | Cố định **chủ ý** cho thí nghiệm đổi tỷ lệ chia | Không (chỉ là script thí nghiệm) |
| [main.py:42](../ml-service/app/main.py), [retrain_from_feedback.py:130](../ml-service/app/lifecycle/retrain_from_feedback.py) `NeedTextModel(n_neighbors=7)` | k của **Mô hình C** (câu tự do), không phải A | Không với A |

Hệ quả: khi có 8000 máy và bạn chạy lại `python -m app.lifecycle.train`, **GridSearchCV tự thử lại
từ đầu** và chọn k mới. Không cần sửa chỗ nào ngoài việc cung cấp dữ liệu mới.

### 7.2 Vậy k có tăng không? Lý thuyết nói gì

- **Lý thuyết (Cover & Hart / Stone):** kNN chỉ tiến đến độ chính xác tối ưu khi **k tăng theo n** nhưng
  **chậm hơn n** (k → ∞ và k/n → 0). Hiểu nôm na: dữ liệu nhiều thì mỗi "khu phố" có nhiều hàng xóm
  đáng tin, nên **được phép hỏi nhiều người hơn** mà vẫn là người gần.
- **Quy tắc nhanh (heuristic) k ≈ √n:** n=800 → ~28; n=8000 → ~89. Đây chỉ là **gợi ý khởi điểm** (comment
  trong code cũng nói vậy), không phải định luật. Điểm k=7 của ta thấp hơn √800 nhiều.
- **Nhưng k tối ưu phụ thuộc vào *độ chồng lấn giữa các lớp*, chứ không chỉ vào n.** Nếu ranh giới giữa
  GAMING/CREATOR rõ ràng thì k nhỏ đã đủ; nếu nhiều máy nằm "nhập nhằng" thì k lớn giúp lọc nhiễu.

### 7.3 Đo thật: k tối ưu thay đổi thế nào khi n tăng

Tôi chạy thử: lấy ngẫu nhiên n máy từ 800 máy học, tìm k tốt nhất bằng đúng cách của code (CV 5 phần,
uniform + euclidean, k từ 1…31), lặp 3 lần với các lần lấy khác nhau:

| n | k tốt nhất qua 3 lần | √n |
|---|---|---|
| 100 | 3, 3, 3 | 10 |
| 200 | 7, 3, 11 | 14 |
| 400 | 5, 5, 7 | 20 |
| 800 | 11, 3, 7 | 28 |

Xu hướng: **k tốt nhất nhích lên khi n tăng** (3 → 5–7 → …) nhưng **rất nhiễu** (ở n=800 ba lần ra 3, 7, 11)
và nằm **thấp xa √n**. Điều này khớp với việc đường cong k ở mục 5 có đỉnh phẳng.

Với 8000 máy thật, tôi **chưa có dữ liệu thật để đo** (chỉ có 1.000 máy). Tôi đã thử giả lập bằng cách nhân bản
800 máy lên 8000 kèm nhiễu, nhưng kết quả **không đáng tin** (bản sao của cùng một máy rơi vào cả phần học
lẫn phần chấm → k=1 điểm cao ảo), nên không dùng. Phải đợi dữ liệu thật rồi chạy lại.

### 7.4 Vì sao k không tự tăng cùng n — và chuyện gì cần để nó tăng

1. **Code không tự đổi k theo n.** k chỉ đổi khi **chạy lại huấn luyện**, vì ta chọn k bằng thực nghiệm
   chứ không dùng công thức.
2. **Dữ liệu nhiều hơn không buộc k lớn hơn.** Nó chỉ *cho phép* k lớn mà không hại. Nếu thêm 7.200 máy
   mà vùng ranh giới vẫn "sạch" thì k=7 vẫn là tốt nhất — và đó là kết quả hợp lệ.
3. **Cảnh báo thật sự: trần k=31 là cố định.** `range(1, 32, 2)` dừng ở 31. Nếu n=8000 mà k tối ưu
   thật là 45, grid search **không bao giờ thấy được** và sẽ trả về 31 (cạnh trần) — một lựa chọn "tốt nhất
   *trong phạm vi đã cho*", không phải tốt nhất thật.
   - **Dấu hiệu nhận biết:** k thắng nằm **sát biên** của lưới (31) và đường cong `k_curve.png` còn đang
     đi lên ở mép phải.
   - **Cách xử lý:** nới lưới theo n, ví dụ `range(1, int(n**0.5)+1, 2)` hoặc `[1,3,5,…,31,41,51,71,91]`. Nhớ
     cập nhật cả `k_curve` ([classifier.py:83](../ml-service/app/models/classifier.py), cũng `range(1, 32, 2)`),
     không thì biểu đồ không phủ hết.
4. **Hai phía của một cái giá:** k lớn làm lớp nhỏ thiệt (mục 5). Với 8000 máy, CREATOR (12%) có ~770 máy,
   đủ nhiều hơn hẳn so với 96 hiện nay nên k lớn bớt hại — một lý do chính đáng khiến k tối ưu *có thể* tăng.

### 7.5 Chi phí khi n tăng

kNN dự đoán phải đo khoảng cách đến **mọi** máy: ~n × 11 phép tính. n=800 → ~9 nghìn; n=8000 → ~88 nghìn
phép tính mỗi lần dự đoán — vẫn tức thì với máy tính hiện nay. Khi lên hàng triệu mới phải dùng cấu trúc
chỉ mục (KD-tree/BallTree, hoặc xấp xỉ như FAISS) thay vì so hết. Việc **huấn luyện** (GridSearch) mới
chậm đi rõ: 320 lần học × dữ liệu gấp 10.

### 7.6 Tóm tắt trả lời hội đồng (30 giây)

> "k trong Mô hình A không cố định mà do GridSearchCV chọn bằng kiểm thử chéo trên 800 máy học; k=7 là
> kết quả. Khi dữ liệu tăng lên, lý thuyết cho phép k lớn hơn vì nhiều máy hơn thì hàng xóm đáng tin hơn,
> nhưng k tối ưu còn phụ thuộc độ chồng lấn giữa các lớp. Nên khi có dữ liệu mới, em chạy lại huấn luyện
> để chọn lại k; riêng lưới thử hiện dừng ở k=31, em sẽ nới lưới nếu k thắng nằm sát biên."

---

## 8. Mô hình thật sự nhìn thấy gì khi dự đoán 1 máy (gắn lại thành chuỗi)

1. Nhận 11 con số của máy mới (nhân viên nhập) — `/predict-segment` ở [main.py](../ml-service/app/main.py).
2. **Tiền xử lý** bằng *đúng trung bình/độ lệch chuẩn của 800 máy học* (mục 2).
3. Đo **Euclid** từ máy mới đến cả 800 máy (mục 3).
4. Lấy **7** máy gần nhất (mục 5).
5. Mỗi máy 1 phiếu (**uniform**, mục 4) → tỷ lệ phiếu = độ tin cậy; nhãn nhiều phiếu nhất thắng.

Cả 3 giá trị (7, uniform, euclidean) được đọc từ `model.joblib`; xem bằng `inspect_model.py` (mục 10).

---

## 9. Bảng "dễ nhầm" — các cặp khái niệm hay bị lẫn

| Cặp | Phân biệt |
|---|---|
| kNN vs Euclidean | kNN = **thuật toán** (hỏi hàng xóm). Euclidean = **thước đo** nó dùng. Thay thước, thuật toán không đổi |
| Tham số vs siêu tham số | Tham số: máy tự học. Siêu tham số (k, metric, weights): người đặt, phải thử để chọn |
| Huấn luyện vs dự đoán | kNN "huấn luyện" chỉ cất dữ liệu; mọi việc nặng làm lúc dự đoán |
| CV macro-F1 (0,794) vs test macro-F1 (0,787) | CV dùng để **chọn** tham số (trên 800); test là điểm **chấm cuối** trên 200 máy chưa thấy. Hai số gần nhau → không quá khớp |
| `n_neighbors` (k) vs `n_samples` | k = số láng giềng hỏi (7). n = số máy trong "danh bạ" (800) |
| k lẻ để làm gì | Hạn chế hòa phiếu; không đảm bảo hết hòa khi có 4 lớp |

---

## 10. Tự kiểm tra các con số trong file này

Đứng ở thư mục `D:\QL_Laptop\ml-service` (PowerShell). Lệnh đọc k/metric/weights của mô hình đang dùng:

```powershell
cd D:\QL_Laptop\ml-service
python -m app.lifecycle.inspect_model
```

Lệnh in đường cong k (mục 5) từ `metadata.json`:

```powershell
cd D:\QL_Laptop\ml-service
python -c "import json; m=json.load(open('artifacts/clf-2026.09.27-160831/metadata.json')); [print(c['k'], round(c['f1_macro_mean'],4)) for c in m['k_curve']]"
```

Chạy lại thí nghiệm chọn k theo n (mục 7.3) cần tự viết vòng lặp như mô tả; kết quả có thể lệch vài
đơn vị vì lấy mẫu ngẫu nhiên (đó cũng chính là điều bảng 7.3 cho thấy: k tốt nhất dao động).

---

## 11. Giới hạn cần thừa nhận (nói trước khi hội đồng hỏi)

1. **Dữ liệu 1.000 máy là dữ liệu nhóm dựng/thu thập**, nhãn phân khúc do nhóm gán; "độ chính xác 0,787"
   chỉ có nghĩa so với nhãn đó, chưa phải so với nhận định của người dùng thật.
2. **Khác biệt giữa các cấu hình nhỏ hơn độ dao động**: Euclid vs Manhattan (0,01), uniform vs distance
   (0,002), k=7 vs 9 (0,01) đều nằm trong ±0,03–0,05. Kết luận chắc chỉ là "k quá nhỏ hoặc quá lớn thì tệ".
3. **k=7 được chọn trên chính dữ liệu này** nên điểm hơi lạc quan (đã ghi trong `split_ratio.py`).
4. Chưa đo được hành vi ở n=8000 thật; mục 7 là lý thuyết + đo trên n ≤ 800.
