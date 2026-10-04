# 16 — Cách giảng bài & hỏi đáp (quy trình dạy người mới đọc code)

> **Cách dùng:** khi người dùng nói *"giải thích theo cách làm file .md"* hoặc *"hỏi đáp theo cách làm
> file .md"*, đọc file này rồi làm đúng quy trình bên dưới. File này đúc kết từ các góp ý của người
> dùng qua nhiều buổi học, nên **mọi quy tắc ở đây đều là yêu cầu thật, không phải gợi ý**.

Người học: **người mới**, chưa biết lập trình, đang tự đọc code đồ án SmartLap để làm báo cáo/slide.
Nhóm chia việc: **TV1 = Mô hình A** (phân loại phân khúc), **TV2 = Mô hình C** (câu tự do), **TV3 = Mô
hình B** (xếp hạng top-5). Lộ trình giảng đi theo phân công này.

---

## 1. Chế độ "GIẢI THÍCH" — 8 quy tắc bất di bất dịch

### 1.1 Từng bước nhỏ, một đoạn code mỗi lần
- **Mỗi lượt chỉ một ý nhỏ** (một danh sách, một hàm, một dòng quan trọng). Không đổ nhiều thông tin.
- Cuối lượt luôn **dừng và chờ người dùng "ok"** mới sang bước kế. Chưa hiểu thì **đổi cách giải thích**
  (bản đồ, tình huống đời thường, ví dụ số khác), không lặp lại y nguyên.
- Thứ tự lộ trình: **tổng quan → cấu trúc thư mục → luồng gọi giữa các file → từng đoạn code**.
  Không nhảy vào chi tiết khi người học chưa thấy bức tranh chung (đã từng bị phàn nàn vì vội).

### 1.2 TRƯỚC khi dẫn người học mở file nào, phải dọn file đó (quy tắc quan trọng nhất)
1. Rà **toàn bộ comment** của file: tiếng Việt **có dấu**, nhất quán (không lẫn không dấu / tiếng Anh).
2. **Rút gọn** comment dài; không viết comment giải thích lại điều code đã tự nói.
3. **Thêm chú thích ngắn cạnh các dòng chính** (vai trò, ai gọi ai) — dạng người dùng đã khen:
   ```ts
   // Gọi sang ML; đường dẫn này khớp @app.post("/predict-segment") bên main.py
   ```
   ```python
   proba = registry.model.predict_proba(X)  # mô hình: chuẩn hóa -> 7 láng giềng -> tỷ lệ phiếu
   ```
   Chú thích **ý nghĩa/vai trò** ở dòng chính, không chú thích dòng hiển nhiên.
4. **Kiểm tra code không đổi** (so code đã bỏ comment giữa bản cũ và mới), chạy `tsc`/`pytest`/`lint`,
   rồi **commit** (nhắn commit tiếng Việt, có dòng `Co-Authored-By`). Chỉ **push khi người dùng bảo**
   (thường cuối buổi).
5. Nếu khi đọc phát hiện **code sai hoặc có bug** → sửa luôn, báo rõ cho người học, kiểm chứng lại.
   (Ví dụ đã làm: máy ghim thiếu `include` làm trắng trang; ML mất catalog rơi vào fallback.)

### 1.3 Luôn kèm CODE THẬT + ĐƯỜNG DẪN + SỐ DÒNG
- Nói "hàm X ở đâu" thì ghi `đường/dẫn/file.ts` + số dòng. Người học sẽ tự mở file ra dò.
- **Trích code thật**, không mô tả suông. Số dòng phải **kiểm tra lại** (sửa file làm dòng dịch chuyển).
- Mọi **con số trong ví dụ phải chạy thật** từ mô hình/dữ liệu (không bịa). Nếu kiểm tra của mình sai,
  nói thẳng, sửa, chạy lại rồi mới dùng.

### 1.4 Mẫu câu "A gọi B" — dạy người học cách diễn đạt
> *"Hàm **A** (`file`, dòng) gọi sang hàm **B** (`file`, dòng) để **lấy [thông tin gì]**. B **nhận
> [dữ liệu gì]**, **xử lý qua đoạn [dòng nào / làm gì]**, rồi **trả [gì] về cho A**."*

Với mỗi cặp hàm: viết câu mẫu → trích code của A (dòng gọi) → "cái cầu nối" (tên đường dẫn/hàm) → trích
code của B (đoạn xử lý, đánh dấu a/b/c) → code A nhận kết quả. Cuối cùng cho **câu tổng kết thuyết trình**.
Rồi **mời người học tự diễn đạt lại** một cặp hàm khác để mình sửa.

### 1.5 Gắn nhãn [CẤU TRÚC] và [DỮ LIỆU/CẤU HÌNH]
Khi giải thích đoạn code, ghi rõ chỗ nào:
- **[CẤU TRÚC — không đổi]**: cú pháp/khuôn bắt buộc của framework, thứ tự bắt buộc.
- **[DỮ LIỆU / CẤU HÌNH — sửa được]**: giá trị tùy bài toán (tên biến, danh sách, tham số, câu chữ).

### 1.6 Giải thích đủ cho NGƯỜI MỚI (không nén)
- Bản nén quá bị phàn nàn là "khó hiểu". Giải thích **khi nào hàm được gọi** (tình huống thật: ai bấm
  nút nào), **dữ liệu vào/ra là gì**, rồi mới đến thuật toán.
- Dùng **ví dụ cụ thể có số**: một máy thật, một tình huống thật; dùng **bảng** để so sánh.
- Dùng **phép so sánh quen thuộc**: ML ↔ backend (`requirements.txt` ↔ `package.json`, FastAPI ↔ Express…),
  "bản đồ + Pytago" cho khoảng cách, "hỏi ý kiến hàng xóm" cho bỏ phiếu kNN.
- Thuật ngữ mới: định nghĩa **ngay lần đầu**, rồi mới dùng.
- **Mọi con số phải nêu NGUỒN và cách TỰ KIỂM TRA** (người học từng hỏi "trung bình, độ lệch chuẩn lấy ở
  đâu?"): ghi số đó do dòng code nào tạo ra (`file:dòng`), tính trên dữ liệu nào (vd 800 máy huấn luyện,
  không phải cả 1.000), lưu ở đâu (vd `model.joblib`), cách tính lại độc lập (đoạn Python hoặc Excel
  `AVERAGE`/`STDEV.P`) và chỉ ra hai kết quả khớp nhau. Nếu có số gần giống nhưng khác (vd tính trên 800 vs
  1.000 máy) thì nói rõ vì sao khác.
- **Lệnh terminal phải kèm "đang đứng ở thư mục nào"** (người học chạy sai chỗ, báo `No module named 'app'`):
  ghi rõ thư mục cần đứng (và `cd ...` nếu cần), dùng đúng cú pháp PowerShell (nối lệnh bằng `;`, không dùng
  `&&`), **tự chạy thử đúng như người học sẽ gõ** từ thư mục gốc dự án trước khi hướng dẫn.
- **Không nhảy cóc phép tính** (người học không chuyên code, đã phàn nàn khi bảng chỉ có kết quả cuối):
  khi một con số trong bảng được tính ra, **viết từng bước** theo thứ tự: số đầu vào (kèm nguồn, vd trung
  bình/độ lệch chuẩn lấy từ mô hình) -> công thức -> thay số -> kết quả từng bước -> kết quả cuối, đủ
  để người học bấm máy tính tự kiểm tra. Nêu rõ số nào là làm tròn của số nào. Cho cả phép tính "đối
  chiếu" (trước/sau) để thấy chỗ khác nhau, rồi mời người học tự tính lại một ví dụ khác.

### 1.7 Cuối mỗi bước
0. **CHẠY THỬ TRÊN ỨNG DỤNG để demo** (bước bắt buộc, từng bị thiếu): sau khi giải thích xong, chỉ người học
   **bấm gì, ở màn hình nào, kết quả mong đợi là gì**, và **tự thử trước trên app thật** (trình duyệt) để
   chắc từng nhãn nút/kết quả khớp. Nếu thao tác sẽ ghi dữ liệu thì dùng cách chỉ-xem (vd mở form Sửa rồi
   bấm Hủy), hoặc dặn xóa dữ liệu thử sau khi xong. Ghi kịch bản vào `15_...` để dùng làm demo/slide.
1. Tóm tắt **một câu** (câu mẫu A gọi B).
2. Một **câu hỏi kiểm tra** để người học tự diễn đạt lại (vd "RAM 128GB thì khoảng cách 64→128 sau
   log₂ là bao nhiêu?").
3. Hỏi "ok chưa"; báo trước **bước nhỏ kế tiếp** là gì.

### 1.8 Khi người học chưa hiểu
Đừng nhắc lại cùng một lời. Đổi sang: hình bản đồ / tình huống thật / tính tay số nhỏ / chạy code
cho thấy số thật. Hỏi **chính xác chỗ nào mờ** (khi nào gọi? chuẩn hóa? bỏ phiếu?).

---

## 2. Chế độ "HỎI ĐÁP" (để chuẩn bị bảo vệ trước hội đồng)

Mỗi câu hỏi trả lời theo khuôn **5 phần**, ngắn gọn:

| # | Phần | Nội dung |
|---|---|---|
| 1 | **Câu hỏi** | Câu hội đồng có thể hỏi, ngôn ngữ đời thường |
| 2 | **Trả lời 1–2 câu** | Ngắn, nói được thành lời |
| 3 | **Bằng chứng** | Con số thật + `file:dòng` (hoặc ảnh `k_curve.png`, ma trận nhầm lẫn…) |
| 4 | **Ví dụ minh họa** | 1 máy/1 tình huống cụ thể |
| 5 | **Hạn chế nói thẳng** | Điểm yếu thật (vd CREATOR↔GAMING recall 0,44; dữ liệu tổng hợp) |

Quy tắc: **không bịa số**; số nào cũng phải truy được về artifact/code; nói rõ khi có hai con số khác
cách tính (vd macro-F1 0,773 do `evaluate.py` vs 0,794 do `train.py`). Mời người học **tự trả lời trước**
rồi mình góp ý. Câu hỏi hội đồng đã soạn cho từng mô hình nằm ở `15_HUONG_DAN_3_THANH_VIEN.md`.

---

## 3. Quy ước kỹ thuật khi sửa code trong lúc giảng

- Comment tiếng Việt **có dấu, ngắn**; chuỗi hiển thị cho người dùng cuối cũng có dấu.
- **Hạn chế ký hiệu lạ** như ★ (và emoji trong code/comment/tài liệu kỹ thuật): dùng chữ thường, dấu `;`
  hoặc `x`. Nếu đã lỡ dùng thì sửa luôn.
- Không đổi hành vi code khi chỉ "dọn comment" (chứng minh bằng so sánh code đã bỏ comment).
- Dùng subagent song song để dọn nhiều file; **tự kiểm tra lại** kết quả trước khi commit.
- Không tự push; không ghi dữ liệu thật qua giao diện khi chưa được phép (bị chặn từng lần) — dữ liệu
  thử nghiệm tạo ra phải **dọn sạch** sau khi test.
- Tài liệu mới để dùng cho slide/báo cáo: lưu vào `docs/` và thêm dòng vào mục lục `00_README.md`.

---

## 4. Tiến độ bài học (cập nhật cuối mỗi buổi)

| Phần | Trạng thái |
|---|---|
| Kiến trúc tổng thể 3 tầng (FE / BE / ML) | ✅ |
| Cấu trúc thư mục + cách gọi API + middleware + Prisma (BE, FE) | ✅ |
| Cấu trúc `ml-service` (2 giai đoạn: huấn luyện / phục vụ; 3 nhóm `data` · `models` · `lifecycle`) | ✅ |
| **TV1 / Mô hình A** — kNN bằng "bản đồ", công thức Pytago (đã kiểm chứng 1,7957) | ✅ |
| TV1 — luồng gọi: `predictSegment` (BE) → `predict_segment` (ML), khi nào được gọi | ✅ |
| TV1 — `features.py`: 11 đặc trưng (3 nhóm), A khác B ở chỗ nào, vì sao A không có giá | ✅ |
| TV1 — vì sao RAM/SSD lấy log₂ | ✅ |
| TV1 — chuẩn hóa z-score (`StandardScaler`) với số thật cột `weight_kg`, ví dụ 2 máy A/B (60% / 40%) | ✅ |
| TV1 — nguồn của trung bình/độ lệch chuẩn (tính trên 800 máy huấn luyện, lưu trong `model.joblib`) + kịch bản demo trên app (mục 3 của `15_...`) | ✅ |
| TV1 — tính khoảng cách đủ 11 cột giữa 2 máy, từng bước (docs/15 mục 1.13) | ✅ |
| Huấn luyện làm gì: 11 bước trong `lifecycle/train.py` (chia 80/20, thử 64 tổ hợp x 5 phần = 320 lần học, lưu phiên bản, `LATEST`) | ✅ tổng quan |
| Dữ liệu: `data/processed/catalog_vn.csv` (huấn luyện đọc file này, KHÔNG đọc Excel), cách thêm dữ liệu bằng Excel (docs/15 mục 1.14) | ✅ |
| TV1 — **Bước 3 huấn luyện: thử 64 tổ hợp** (`grid_search` ở `models/classifier.py`, tính tay 64 x 5 = 320) HOẶC làm **bản đồ 3 tầng** (docs/18) | **Bước kế tiếp (chờ người học chọn)** |
| TV1 — tìm 7 láng giềng + bỏ phiếu (`predict_proba`, `kneighbors`; `models/classifier.py`, `main.py` dòng 96) | ⏳ |
| TV1 — huấn luyện: `GridSearchCV`, `Pipeline` chống rò rỉ dữ liệu, macro-F1 | ⏳ |
| Quản lý mô hình: huấn luyện chỉ lưu bản Ứng viên, `Đưa vào sử dụng` mới đổi `LATEST`; có nút Xóa bản dư (không xóa Champion) | ✅ đã làm trong code, chưa giảng |
| TV1 — hàng đợi Duyệt nhãn / khóa nhãn (`applySegmentLabel`) | ⏳ |
| **TV2 / Mô hình C** — TF-IDF + kNN cosine (`models/text_classifier.py`) | ⏳ |
| **TV3 / Mô hình B** — kNN khoảng cách một phía (`models/retriever.py`, `explain.py`) | ⏳ |

> Nơi lưu nội dung đã giảng để làm slide: `15_HUONG_DAN_3_THANH_VIEN.md` (bổ sung phần TV2, TV3 khi học xong).
