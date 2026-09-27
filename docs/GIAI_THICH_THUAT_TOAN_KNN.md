# Giải thích thuật toán k-Nearest Neighbors (kNN) trong SmartLap

> Tài liệu này viết cho người **chưa từng học Machine Learning** vẫn đọc hiểu được, đồng thời đủ
> cụ thể (trích dẫn file:dòng) để người **đã biết code** đọc sâu vào từng dòng thực thi thật của
> đồ án. Mục tiêu: khi bảo vệ đồ án, có thể giải thích rõ ràng "kNN là gì, tại sao chọn nó, và nó
> chạy như thế nào trong hệ thống này" mà không cần học thuộc lòng.

---

## 1. kNN là gì, nói bằng ví dụ đời thường

Tưởng tượng bạn chuyển đến một khu phố lạ và muốn biết giá thuê nhà hợp lý cho căn hộ của mình.
Bạn không có công thức tính giá — nhưng bạn có thể **đi hỏi 5 người hàng xóm ở gần nhà bạn nhất**
(diện tích, số phòng, khoảng cách trung tâm gần giống bạn), xem họ đang thuê giá bao nhiêu, rồi
lấy giá **trung bình** (hoặc phổ biến nhất) của 5 người đó làm câu trả lời.

Đó chính xác là kNN (k-Nearest Neighbors — "k người láng giềng gần nhất"):

1. Không có công thức toán học cố định để tính câu trả lời.
2. Khi có một trường hợp mới, đo **khoảng cách** từ nó đến tất cả các trường hợp đã biết.
3. Chọn ra **k trường hợp gần nhất** (k là một số bạn tự chọn, ví dụ k=5).
4. Trả lời dựa trên đa số/trung bình của k trường hợp đó.

Hai việc kNN có thể làm:
- **Phân loại (classification)**: trả lời "thuộc nhóm nào?" — ví dụ: máy này có thuộc nhóm
  GAMING không? → nhìn k máy gần nhất, xem đa số chúng thuộc nhóm nào.
- **Truy hồi (retrieval/regression)**: trả lời "cái nào gần với tôi cần nhất?" — ví dụ: trong
  1000 máy, 5 máy nào gần với "máy trong mơ" của người dùng nhất?

SmartLap dùng **cả hai kiểu** cho 3 việc khác nhau (chi tiết ở mục 4).

---

## 2. Trước khi có kNN, người ta giải quyết bài toán này thế nào?

### 2.1 Bối cảnh lịch sử

kNN được đề xuất lần đầu năm **1951** bởi Evelyn Fix và Joseph Hodges (báo cáo kỹ thuật cho
Không quân Mỹ, USAF School of Aviation Medicine), sau đó được **Thomas Cover** hoàn thiện về mặt
lý thuyết năm **1967** (chứng minh cận sai số của kNN so với "bộ phân loại tối ưu lý thuyết").
Đây là một trong những thuật toán học máy **cổ nhất** còn được dùng rộng rãi — ra đời trước cả
khi ngành "Machine Learning" tồn tại như một lĩnh vực riêng.

Ý tưởng cốt lõi ("vật giống nhau thì ở gần nhau", tiếng Anh: *"birds of a feather flock
together"*) thực ra là trực giác con người dùng từ rất lâu; kNN chỉ là công thức hoá trực giác đó
thành một thuật toán tính được bằng máy tính.

### 2.2 Cách làm PHỔ BIẾN trước/thay vì dùng kNN cho bài toán "gợi ý laptop"

Trước khi nhóm quyết định dùng kNN làm lõi, hướng tiếp cận "hiển nhiên" nhất mà một người mới học
lập trình thường nghĩ tới là **luật if-else** (rule-based), việc này cũng chính là baseline được
so sánh trong đồ án (`rule_based_baseline` — [ml-service/app/classifier.py:77](../ml-service/app/classifier.py)):

```
Nếu CPU điểm > 20000 VÀ có GPU rời VÀ RAM >= 16GB  → Gaming
Nếu trọng lượng < 1.5kg VÀ không có GPU rời         → Ultrabook
Nếu RAM >= 32GB VÀ có GPU rời mạnh                  → Creator
Ngược lại                                            → Office
```

Cách này có 3 vấn đề nền tảng mà kNN giải quyết được:

| Vấn đề của luật if-else | kNN giải quyết thế nào |
|---|---|
| **Ranh giới cứng, không tự nhiên**: một máy CPU=19999 (thua 1 điểm) bị xếp khác hẳn máy CPU=20001, dù thực tế hai máy gần như giống hệt nhau | kNN không có "ngưỡng cắt" — nó nhìn TOÀN BỘ hàng xóm gần nhất, ranh giới mềm và tự nhiên hơn |
| **Người viết luật phải tự đoán ngưỡng** (tại sao là 20000 mà không phải 21000?) — mang định kiến chủ quan | kNN học ngưỡng "ẩn" từ chính dữ liệu, không cần đoán số tay |
| **Không mở rộng được khi có nhiều tiêu chí chồng chéo** (giá, hiệu năng, cân nặng, màn hình, thương hiệu, khuyến mãi... cùng lúc — luật if-else sẽ nổ ra hàng trăm nhánh) | kNN xử lý **không gian nhiều chiều** tự nhiên: mỗi tiêu chí là 1 "chiều", khoảng cách được tính gộp trên tất cả các chiều cùng lúc |

Đây chính là yêu cầu gốc số 7 mà giảng viên đặt ra: *"kNN phải là thuật toán LÕI, không phải luật
if-else"* — và đồ án đã đo lường cụ thể: trên bộ dữ liệu có phân khúc chồng lấn thực tế, kNN vượt
baseline luật if-else **+0,155 macro-F1** (xem [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md)
mục 2) — tức là chứng minh bằng số liệu rằng kNN thực sự tốt hơn, không phải chọn vì "nghe tên
hay".

Các hướng khác nặng hơn cũng từng được cân nhắc (không dùng vì lý do nêu bên dưới):
- **Decision Tree / Random Forest**: mạnh hơn if-else nhưng vẫn là luật (dù luật "học" tự động) —
  khó giải thích "vì sao gợi ý máy này" theo cách trực quan như kNN (kNN giải thích được: "vì máy
  X giống 90% với 5 máy gần nhất mà bạn có thể thích").
- **Mạng nơ-ron sâu (Deep Learning)**: cần rất nhiều dữ liệu (hàng trăm nghìn mẫu) mới phát huy
  được, trong khi đồ án chỉ có ~1000 máy và 132 câu mô tả nhu cầu — dữ liệu quá nhỏ, dùng deep
  learning sẽ overfit (học vẹt) chứ không học được quy luật thật.

---

## 3. Nguyên tắc cốt lõi để hiểu kNN (bắt buộc phải nắm trước khi đọc code)

### 3.1 Ba thứ luôn phải có: **Khoảng cách, k, Cách tổng hợp kết quả**

1. **Hàm khoảng cách** (distance function): công thức đo "A và B giống nhau đến mức nào", ra một
   con số càng nhỏ càng giống. Phổ biến nhất là khoảng cách Euclidean (đường thẳng nối 2 điểm
   trong không gian nhiều chiều):
   ```
   d(A, B) = sqrt( (a1-b1)² + (a2-b2)² + ... + (an-bn)² )
   ```
2. **k**: số láng giềng được xét. k nhỏ (vd k=1) → rất nhạy với nhiễu (1 máy lạ gần nhất có thể
   làm sai lệch kết quả). k lớn → mượt hơn nhưng có thể "pha loãng" mất đặc trưng riêng.
3. **Cách tổng hợp**: với phân loại — biểu quyết đa số (có thể có trọng số theo khoảng cách, máy
   càng gần càng "có tiếng nói" lớn hơn); với truy hồi — không tổng hợp thành 1 giá trị mà **trả
   về nguyên danh sách k láng giềng đã sắp xếp** (đây là top-N gợi ý).

### 3.2 Vì sao phải "chuẩn hoá" (scale) dữ liệu trước khi tính khoảng cách

Đây là lỗi phổ biến nhất khi mới học kNN. Ví dụ: giá laptop dao động 8.000.000 - 100.000.000 (đơn
vị triệu đồng), còn RAM dao động 4 - 64 (đơn vị GB). Nếu tính khoảng cách trực tiếp trên số thô,
chênh lệch giá vài triệu đồng (con số hàng triệu) sẽ **át hoàn toàn** chênh lệch RAM vài GB (con
số hàng chục) — dù cả hai có thể quan trọng như nhau với người dùng.

**Giải pháp**: chuẩn hoá mỗi đặc trưng về cùng một thang đo trước khi tính khoảng cách — đồ án
dùng `StandardScaler` (z-score: trừ trung bình, chia độ lệch chuẩn) —
[ml-service/app/retriever.py:81-85](../ml-service/app/retriever.py). Sau bước này, "1 đơn vị" của
CPU score và "1 đơn vị" của giá đều mang cùng ý nghĩa thống kê (số độ-lệch-chuẩn so với trung
bình), nên phép cộng khoảng cách giữa các chiều mới công bằng.

**Lỗi rất dễ mắc kèm theo (đã được chặn bằng test trong đồ án)**: bước chuẩn hoá phải được "học"
(fit) chỉ trên tập huấn luyện rồi mới áp dụng cho tập kiểm tra — nếu để `StandardScaler` học luôn
trên toàn bộ dữ liệu (gồm cả phần sẽ dùng để đánh giá) thì mô hình đã "nhìn trộm" thống kê của dữ
liệu kiểm tra trước khi bị kiểm tra — gọi là **rò rỉ dữ liệu (data leakage)**, làm điểm đánh giá
ảo cao hơn thực tế. Đồ án ép `StandardScaler` phải nằm **bên trong** `Pipeline` của scikit-learn
(`build_pipeline()` — [ml-service/app/classifier.py:41](../ml-service/app/classifier.py)), được
kiểm chứng bằng test riêng `test_scaler_inside_pipeline`.

### 3.3 Trọng số (weights) — không phải mọi đặc trưng đều quan trọng như nhau

Công thức Euclidean chuẩn coi mọi chiều quan trọng ngang nhau. Nhưng thực tế: người ưu tiên "hiệu
năng" 5/5 thì CPU/GPU phải ảnh hưởng đến kết quả NHIỀU hơn kích thước màn hình. Giải pháp là
**Euclidean có trọng số**:
```
d(x, q) = sqrt( Σⱼ wⱼ · (xⱼ - qⱼ)² ),   Σⱼ wⱼ = 1
```
mỗi chiều `j` được nhân thêm hệ số `wⱼ` — chiều nào người dùng quan tâm hơn thì `wⱼ` lớn hơn,
đóng góp nhiều hơn vào tổng khoảng cách. Đây chính là cơ chế `build_weights()` trong đồ án (mục
5.2 bên dưới).

### 3.4 Khoảng cách MỘT PHÍA (one-sided) — cải tiến riêng của đồ án này

Đây là điểm **khác biệt quan trọng nhất** so với kNN "sách giáo khoa", xuất phát từ góp ý của
giảng viên: *"không được phạt máy mạnh hơn hoặc rẻ hơn mức cần"*.

Với Euclidean thường, khoảng cách là **hai chiều**: nếu bạn cần CPU điểm 15000 mà máy có CPU
20000, nó bị coi là "cách xa 5000" y hệt như một máy chỉ có CPU 10000 (cũng cách 5000, nhưng theo
hướng ngược lại — quá yếu). Điều này vô lý với trực giác con người: **máy mạnh hơn nhu cầu không
đáng bị coi là "tệ"** như máy yếu hơn nhu cầu.

Giải pháp của đồ án — [ml-service/app/retriever.py:189-211](../ml-service/app/retriever.py)
(`one_sided_distance`) — mỗi đặc trưng có một "hướng tốt" khai báo trước trong
`FEATURE_DIRECTION` ([retriever.py:51-68](../ml-service/app/retriever.py)):

```
huong +1 (cang cao cang tot, vd CPU, RAM):  pen = max(0, q - x)   # chi phat khi may YEU HON q
huong -1 (cang thap cang tot, vd gia, can nang): pen = max(0, x - q)  # chi phat khi may DAT/NANG HON q
huong  0 (hai phia, vd kich thuoc man hinh): pen = |x - q|        # lech huong nao cung phat
```

Nói cách khác: nếu máy **vượt** yêu cầu theo hướng có lợi (mạnh hơn, rẻ hơn, nhẹ hơn), khoản phạt
(`pen`) bằng 0 — không hề bị trừ điểm. Chỉ khi máy **thiếu** so với nhu cầu mới bị phạt.

---

## 4. Ba mô hình kNN trong SmartLap — ứng dụng thật với đồ án này

SmartLap không dùng "một cục kNN" cho mọi việc, mà tách thành 3 mô hình, mỗi mô hình giải quyết
một bài toán khác nhau trong luồng nghiệp vụ:

```
Người dùng gõ câu tự nhiên
        │
        ▼
 [Mô hình C] TF-IDF + kNN  ──► suy ra: nhóm nhu cầu, ngân sách, ưu tiên, ràng buộc
        │
        ▼
 [Mô hình A] kNN phân lớp  ──► (khi thêm máy mới, hoặc khi người dùng chọn "Chưa rõ") suy ra
        │                       PHÂN KHÚC phù hợp (Gaming/Ultrabook/Creator/Office)
        ▼
 [Mô hình B] kNN truy hồi  ──► từ hồ sơ nhu cầu đầy đủ, tìm ra TOP-5 MÁY gần nhất
        │                       (đây là màn hình "Kết quả gợi ý" người dùng thấy)
        ▼
   Top-5 laptop + % phù hợp + giải thích
```

### 4.1 Mô hình A — kNN PHÂN LỚP phân khúc (`KNeighborsClassifier`)

**Bài toán**: cho một cấu hình máy (CPU, GPU, RAM, giá, cân nặng...), đoán xem nó thuộc phân khúc
nào trong 4 nhóm: OFFICE / ULTRABOOK / GAMING / CREATOR.

**Vì sao cần**: khi nhân viên nhập một máy MỚI vào hệ thống, hệ thống phải tự gán nhãn phân khúc
— không thể bắt nhân viên tự phân loại bằng tay (dễ sai, không nhất quán). Đây cũng là minh chứng
cho tiêu chí "hệ thống tự học/tự phân loại máy mới" trong đề bài.

**Code thật**: [ml-service/app/classifier.py:41-54](../ml-service/app/classifier.py) (`build_pipeline`)
```python
def build_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),      # chuan hoa TRUOC, va nam TRONG pipeline (chong ro ri)
        ("knn", KNeighborsClassifier()),   # k, weights, metric duoc do GridSearchCV tim ra
    ])
```
Tham số tốt nhất được tìm bằng `GridSearchCV` (dò lưới) kết hợp `StratifiedKFold` 5 lần
([classifier.py:56-75](../ml-service/app/classifier.py)) — "Stratified" nghĩa là mỗi lần chia dữ
liệu train/test đều giữ đúng TỈ LỆ 4 phân khúc như bộ dữ liệu gốc, tránh trường hợp ăn may một
lần chia mà một phân khúc hiếm bị dồn hết vào tập test.

**Số liệu thật** (sau lần retrain gần nhất, xem
[KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 2): k=7, metric=Euclidean, weights=uniform,
macro-F1 trên tập test = **0,787** (mục tiêu ≥ 0,75).

### 4.2 Mô hình B — kNN TRUY HỒI có trọng số một phía (`NearestNeighbors`)

**Bài toán**: đây là bộ não chính của tính năng "gợi ý" — cho một **hồ sơ nhu cầu** (ngân sách,
mức ưu tiên hiệu năng/di động/màn hình/tiết kiệm, phân khúc mong muốn...), tìm ra 5 máy trong
catalog **gần** với nhu cầu đó nhất.

Khác với Mô hình A (trả lời "thuộc nhóm nào"), Mô hình B trả lời "**cái nào gần tôi cần nhất**" —
đây là dạng "truy hồi" (retrieval) của kNN, dùng lớp `NearestNeighbors` (không phải
`KNeighborsClassifier`) vì không có nhãn để phân loại, chỉ có khoảng cách để xếp hạng.

**4 bước xử lý thật, theo đúng thứ tự code chạy:**

**Bước 1 — Dựng "máy trong mơ" (ideal vector) từ mức ưu tiên** —
`build_ideal_vector()` [retriever.py:88-147](../ml-service/app/retriever.py). Đây không phải một
máy có thật, mà là một **điểm trong không gian nhiều chiều** được suy ra từ phân vị (percentile)
của chính tập ứng viên. Ví dụ cụ thể: người dùng chọn "hiệu năng" = 5/5 → tra bảng
`PERCENTILE_BY_PRIORITY` ([retriever.py:21](../ml-service/app/retriever.py)) ra phân vị 90 → nghĩa
là "CPU trong mơ" = giá trị CPU mà chỉ 10% máy trong catalog mạnh hơn (một cách nói: "tôi muốn một
trong những máy mạnh nhất, nhưng không nhất thiết là mạnh NHẤT tuyệt đối").

**Bước 2 — Tính trọng số mỗi đặc trưng** — `build_weights()`
[retriever.py:150-186](../ml-service/app/retriever.py). Ví dụ cụ thể (trích nguyên văn docstring
trong code): người dùng đặt "hiệu năng" = 5/5, phân khúc GAMING có hệ số nền mặc định cho nhóm
hiệu năng là 1.3 → trọng số thô của nhóm = `5 × 1.3 = 6.5`. Nhóm hiệu năng gồm 4 đặc trưng
(cpu_score, gpu_score, ram_gb, ssd_gb) nên mỗi đặc trưng nhận `6.5 / 4 = 1.625`. Cuối cùng TẤT CẢ
trọng số (mọi nhóm cộng lại) được chia cho tổng, để tổng luôn bằng 1 — điều kiện bắt buộc của
công thức Euclidean có trọng số (mục 3.3).

**Bước 3 — Tính khoảng cách MỘT PHÍA và đưa thẳng vào kNN** —
`one_sided_distance()` + `make_one_sided_metric()`
[retriever.py:189-229](../ml-service/app/retriever.py), rồi truyền thẳng vào
`NearestNeighbors(metric=callable)` ở [retriever.py:271-274](../ml-service/app/retriever.py). Đây là
điểm mấu chốt trả lời yêu cầu "kNN phải là lõi, không phải xếp hạng lại bên ngoài": hàm khoảng
cách tuỳ biến được đưa **trực tiếp vào tham số `metric` của thuật toán kNN gốc**, không phải chạy
kNN xong rồi viết thêm code để "sắp xếp lại theo ý mình".

> **Lỗi nghiêm trọng từng gặp và cách phát hiện (đáng kể khi bảo vệ đồ án)**: scikit-learn gọi
> hàm `metric(a, b)` theo thứ tự `(điểm truy vấn, điểm trong catalog)`, ngược với thứ tự
> `(x, q)` mà công thức một phía cần. Vì hàm này **không đối xứng** (`d(x,q) ≠ d(q,x)`), việc gọi
> sai thứ tự làm **lật dấu phạt** — hệ thống vô tình ưu tiên máy YẾU HƠN thay vì MẠNH HƠN. Lỗi
> này được phát hiện bằng cách so sánh thủ công một trường hợp cụ thể (máy mạnh hơn nhu cầu phải
> được xếp hạng cao, nhưng thực tế lại xếp thấp), sửa bằng cách đảo tham số tường minh trong
> `metric()` ở [retriever.py:225-227](../ml-service/app/retriever.py), và chặn tái phát bằng
> `test_one_sided_metric_argument_order` trong
> [ml-service/tests/test_one_sided_metric.py](../ml-service/tests/test_one_sided_metric.py). Sau
> khi sửa, nDCG@5 (độ đo chất lượng xếp hạng) tăng từ 0,589 lên 0,788 trong lần đo đó — con số cụ
> thể chứng minh lỗi này ảnh hưởng lớn thế nào.

**Bước 4 — Lọc mềm theo phân khúc thay vì lọc cứng** —
[retriever.py:259-264](../ml-service/app/retriever.py). Thay vì loại bỏ thẳng các máy khác phân khúc
mong muốn (lọc cứng — có thể bỏ sót máy tốt), "độ khớp phân khúc" được đưa vào làm **một đặc
trưng nữa trong metric** (trọng số cố định `SEGMENT_SOFT_WEIGHT = 0.18`
— [retriever.py:235](../ml-service/app/retriever.py)): máy khác phân khúc bị trừ điểm nhẹ nhưng
**vẫn có cơ hội** lọt top-5 nếu các mặt khác thực sự vượt trội.

**Ứng dụng thật mới nhất — khuyến mãi & lượt bán** (trả lời yêu cầu: "máy giá gốc cao hơn nhưng
giảm giá sâu hơn, bán chạy hơn vẫn có thể được chọn nhiều hơn"): 2 đặc trưng `discount_percent`
(% giảm giá) và `sales_score` (lượt bán, đã log-hoá) được thêm vào nhóm `"popularity"`
([retriever.py:31-37](../ml-service/app/retriever.py)), hướng luôn là "+1" (càng cao càng tốt, không
phạt khi vượt — [retriever.py:63-64](../ml-service/app/retriever.py)), với trọng số **cố định**
`POPULARITY_WEIGHT = 0.12` (không có thanh trượt riêng cho người dùng chỉnh, vì đây là tín hiệu
hành vi thị trường, không phải tiêu chí kỹ thuật người dùng tự chọn).

### 4.3 Mô hình C — kNN phân loại VĂN BẢN tự do (TF-IDF + cosine kNN)

**Bài toán**: người dùng gõ một câu tiếng Việt tự nhiên, không có cấu trúc — ví dụ *"con học kế
toán, cần máy bền, rẻ"* — hệ thống phải tự hiểu: đây thuộc nhóm nhu cầu nào (Văn phòng/Học tập/
Lập trình/Đồ họa/Gaming/Di động), ngân sách khoảng bao nhiêu, có ràng buộc gì đặc biệt.

**Vì sao dùng kNN chứ không phải luật regex thuần**: câu tiếng Việt tự do có vô số cách diễn đạt
cho cùng một ý ("cần máy bền" / "máy chắc chắn" / "xài được lâu" đều có nghĩa gần giống nhau) —
không thể liệt kê hết bằng regex. Cần một cách đo "độ giống nhau về Ý NGHĨA" giữa câu mới và các
câu mẫu đã biết nhãn — đây lại là bài toán "tìm hàng xóm gần nhất", nên kNN áp dụng được, chỉ khác
là "khoảng cách" ở đây đo trên **văn bản** thay vì **số**.

**Cách biến văn bản thành số để đo khoảng cách được — TF-IDF**: mỗi câu được biến thành một vector
số, mỗi chiều là 1 từ (hoặc cụm ký tự), giá trị càng cao nếu từ đó **xuất hiện nhiều trong câu này
NHƯNG hiếm gặp ở các câu khác** (nên nó "đặc trưng" cho câu này). Ví dụ từ "rẻ" xuất hiện ở rất
nhiều câu nên trọng số thấp, nhưng "kế toán" chỉ xuất hiện ở nhóm Văn phòng nên trọng số cao —
giúp phân biệt nhóm tốt hơn là đếm từ đơn thuần.

**Code thật** — `build_text_pipeline()`
[ml-service/app/text_classifier.py:94-128](../ml-service/app/text_classifier.py):
```python
FeatureUnion([
    ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), ...)),   # cum 1-2 tu lien tiep
    ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), ...)),# cum 3-5 KY TU lien tiep
])
...
KNeighborsClassifier(n_neighbors=n_neighbors, metric="cosine", weights="distance")
```
Hai điểm đáng chú ý:
- **Kết hợp 2 loại TF-IDF** (từ + ký tự): TF-IDF theo TỪ bắt được ý nghĩa cụm từ, nhưng tiếng
  Việt hay bị gõ thiếu dấu hoặc sai chính tả ("hoc ke toan" thay vì "học kế toán") — khi đó
  TF-IDF theo CỤM KÝ TỰ (char n-gram) vẫn bắt được sự tương đồng ở mức ký tự, giúp mô hình
  "chịu được" câu không dấu/gõ sai — đã kiểm thử: câu không dấu cho kết quả giống hệt câu có dấu.
- **Khoảng cách cosine thay vì Euclidean**: với vector TF-IDF (rất nhiều chiều, đa số bằng 0 vì
  một câu ngắn không chứa hết mọi từ trong từ điển), cosine đo **góc** giữa 2 vector thay vì độ
  dài đoạn thẳng nối chúng — phù hợp hơn vì độ dài câu (số từ) không nên ảnh hưởng đến việc "có
  giống ý nghĩa hay không".

**Số liệu thật**: 132 câu tiếng Việt viết tay, 6 nhóm nhu cầu, k=7, macro-F1 (5-fold CV) = 0,7725,
độ chính xác trên 30 câu persona = 93% (xem
[KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) mục 3).

Phần **trích số cụ thể** (ngân sách "tầm 20 triệu", ràng buộc "dưới 1.4kg") vẫn dùng regex —
`extract_budget()` / `extract_constraints()`
([text_classifier.py:139-192](../ml-service/app/text_classifier.py)) — vì đây là tri thức HỖ TRỢ
(trích số, không cần "học"), còn việc **phân loại nhóm nhu cầu** (phần khó, cần hiểu ý nghĩa) mới
là việc do kNN đảm nhiệm.

---

## 5. Ví dụ số cụ thể, tính tay để hiểu bản chất

Giả sử catalog chỉ có 4 máy (đơn giản hoá, chỉ xét 2 đặc trưng: CPU score đã chuẩn hoá và Giá đã
chuẩn hoá), người dùng cần "hiệu năng cao, giá rẻ":

| Máy | CPU (chuẩn hoá) | Giá (chuẩn hoá) |
|---|---|---|
| A | 1.5 | 1.2 (đắt) |
| B | 0.8 | -0.3 (rẻ) |
| C | -1.0 | -1.5 (rất rẻ, rất yếu) |
| D | 1.8 | 0.4 |

Máy trong mơ q (hiệu năng ưu tiên cao → CPU ở phân vị 90 ≈ 1.6; giá ưu tiên rẻ → giá ở biên ngân
sách thấp ≈ -0.5): `q = (CPU=1.6, Gia=-0.5)`.

Với Euclidean **hai phía** thường:
```
d(A, q) = sqrt((1.5-1.6)² + (1.2-(-0.5))²) = sqrt(0.01 + 2.89) = 1.70
d(D, q) = sqrt((1.8-1.6)² + (0.4-(-0.5))²) = sqrt(0.04 + 0.81) = 0.92
```
→ D thắng vì "gần" hơn, nhưng máy A dù MẠNH HƠN và ĐẮT HƠN mức cần cũng bị phạt y hệt máy yếu hơn.

Với khoảng cách **một phía** (CPU hướng +1 "càng cao càng tốt" → không phạt nếu vượt; Giá hướng -1
"càng thấp càng tốt" → không phạt nếu rẻ hơn):
```
pen_CPU(A) = max(0, 1.6 - 1.5) = 0.1        pen_Gia(A) = max(0, 1.2 - (-0.5)) = 1.7
d(A, q) = sqrt(0.1² + 1.7²) = 1.70   (giống Euclidean vi A KEM hon q ve CPU va DAT hon q ve gia)

pen_CPU(D) = max(0, 1.6 - 1.8) = 0 (D MANH HON q, KHONG bi phat!)
pen_Gia(D) = max(0, 0.4 - (-0.5)) = 0.9
d(D, q) = sqrt(0² + 0.9²) = 0.9   (nho hon truoc, vi khong con bi phat oan phan CPU vuot troi)
```
→ D vẫn thắng, nhưng khoảng cách của D giảm từ 0,92 xuống 0,90 (nhẹ, vì D chỉ vượt CPU chút ít so
với q). Để thấy rõ hiệu ứng "không phạt máy mạnh hơn" mạnh tay hơn, hãy tưởng tượng máy D có CPU
= 3.0 (vượt rất xa q=1.6): Euclidean hai phía sẽ phạt `(3.0-1.6)² = 1.96` — coi máy siêu mạnh này
"tệ" gần bằng máy yếu — trong khi một phía cho `pen_CPU = max(0, 1.6-3.0) = 0`, không phạt gì cả.
Đây chính là lý do hàm khoảng cách một phía tồn tại: nó ngăn kNN "trừng phạt oan" những máy tốt
hơn nhu cầu, đúng như yêu cầu gốc của giảng viên.

---

> **Tài liệu liên quan**: [HUONG_DAN_THUAT_TOAN_KNN.md](HUONG_DAN_THUAT_TOAN_KNN.md) là tài liệu
> viết từ giai đoạn sớm hơn của đồ án, có thêm vài đoạn giải thích code chi tiết (cách dò tham số
> bằng GridSearchCV, bảng đối chiếu 9 test cũ) — vẫn hữu ích để đọc thêm, nhưng file này (bạn đang
> đọc) là bản **đầy đủ và cập nhật nhất**, nên dùng làm tài liệu chính khi bảo vệ.

## 6. Muốn tìm hiểu sâu hơn — đọc tiếp phần nào, theo thứ tự

1. **Bắt đầu**: [ml-service/app/retriever.py](../ml-service/app/retriever.py) — đọc từ trên xuống
   theo đúng thứ tự file (docstring đầu file tóm tắt 5 thay đổi quan trọng nhất so với kNN gốc).
2. **Cách 3 mô hình được ghép vào API thực tế**: [ml-service/app/main.py](../ml-service/app/main.py)
   — endpoint `/recommend` ([main.py:121-150](../ml-service/app/main.py)) là nơi gọi cả `build_ideal_vector`,
   `build_weights`, `recommend`, `match_pct` theo đúng thứ tự đã mô tả ở mục 4.2.
3. **Cách chuẩn bị đặc trưng từ dữ liệu thô**: [ml-service/app/features.py](../ml-service/app/features.py)
   (hàm `enrich_catalog`) — nơi tính `value_index`, `ppi`, `discount_percent`, `sales_score`... từ
   các cột thô trong CSV/database.
4. **Bằng chứng bằng số** (không chỉ code mà cả kết quả đo lường thật):
   [KET_QUA_THUC_NGHIEM.md](KET_QUA_THUC_NGHIEM.md) — macro-F1, P@5, nDCG@5, so sánh với 3
   baseline khác, đo "công sức tìm kiếm" thực tế.
5. **Test tự động chứng minh các tính chất quan trọng vẫn đúng sau khi sửa code**:
   - [ml-service/tests/test_one_sided_metric.py](../ml-service/tests/test_one_sided_metric.py) — 4
     test cho khoảng cách một phía (gồm test chặn lỗi thứ tự tham số đã kể ở mục 4.2).
   - [ml-service/tests/test_priority_sensitivity.py](../ml-service/tests/test_priority_sensitivity.py)
     — 19 test kiểm tra "kéo thanh ưu tiên lên thì kết quả phải đổi đúng hướng" trên nhiều phân
     khúc và tổ hợp khác nhau.
6. **Tài liệu tham khảo bên ngoài** (đọc để hiểu nền tảng lý thuyết, không phải để chép):
   - Cover, T. & Hart, P. (1967), *"Nearest neighbor pattern classification"*, IEEE Transactions
     on Information Theory — bài báo gốc chứng minh cận sai số lý thuyết của kNN.
   - scikit-learn docs: [`sklearn.neighbors.KNeighborsClassifier`](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KNeighborsClassifier.html)
     và [`sklearn.neighbors.NearestNeighbors`](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html)
     — đọc kỹ phần "Parameters" của `metric` để hiểu vì sao truyền được hàm tự viết vào đó.
   - scikit-learn User Guide: [*"Nearest Neighbors"*](https://scikit-learn.org/stable/modules/neighbors.html)
     — giải thích thêm về `algorithm="brute"` (đồ án dùng brute-force vì hàm khoảng cách tự viết
     không tương thích với các cấu trúc chỉ mục nhanh như KD-Tree/Ball-Tree).
