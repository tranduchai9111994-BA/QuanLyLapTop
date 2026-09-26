# 07 — UI/UX: Hệ thống thiết kế SmartLap

> Phong cách: **tươi sáng, sạch, đáng tin** — nền trắng và xanh dương nhạt, điểm nhấn xanh dương sáng, các yếu tố AI dùng dải chuyển xanh dương → xanh lơ. Chỉ có giao diện sáng (không dark mode) để tập trung chất lượng.
> File này là **nguồn duy nhất** cho màu, chữ, khoảng cách. Frontend không tự chọn giá trị ngoài bảng này.

## 1. Nguyên tắc thiết kế

1. **Rõ trước, đẹp sau** — người dùng phổ thông phải hiểu kết quả không cần biết thông số.
2. **AI minh bạch** — mọi nội dung do AI tạo có dấu hiệu nhận biết (huy hiệu ✨, viền xanh lơ) và nút "Vì sao?".
3. **Một hành động chính mỗi màn** — nút chính màu xanh đậm, nổi bật duy nhất.
4. **Khoảng trắng rộng** — thẻ thoáng, không nhồi thông số.
5. **Tôn trọng quyết định người dùng** — AI gợi ý, không ép; luôn có đường đổi lựa chọn.

## 2. Màu sắc

### 2.1 Token chính (`src/theme/tokens.ts`)

| Token | Hex | Dùng cho |
|---|---|---|
| `primary-50` | `#EEF5FF` | Nền vùng nhấn, hover hàng bảng |
| `primary-100` | `#DCEBFF` | Nền tag, nền bước wizard đang chọn |
| `primary-200` | `#B9D6FF` | Viền focus nhẹ |
| `primary-400` | `#4C9AFF` | Biểu đồ, icon phụ |
| `primary-500` | `#1A73E8` | **Màu chính** — nút chính, link, thanh trượt |
| `primary-600` | `#1559C1` | Hover nút chính |
| `primary-700` | `#0F4494` | Active, chữ trên nền primary-50 |
| `ai-500` | `#06B6D4` | Yếu tố AI (xanh lơ) |
| `ai-gradient` | `linear-gradient(135deg, #1A73E8 0%, #06B6D4 100%)` | Huy hiệu AI, thanh điểm phù hợp, hero |
| `bg-page` | `#F5F9FF` | Nền trang |
| `bg-surface` | `#FFFFFF` | Thẻ, bảng, modal |
| `bg-subtle` | `#F0F5FC` | Nền khối thông số, input disabled |
| `border` | `#E2EAF5` | Viền thẻ, đường kẻ bảng |
| `border-strong` | `#C9D6E8` | Viền input |
| `text-primary` | `#0F1B2D` | Tiêu đề, nội dung chính |
| `text-secondary` | `#4A5B73` | Mô tả, nhãn |
| `text-tertiary` | `#64748B` | Chú thích, placeholder |
| `success` | `#15803D` | Điểm mạnh, 👍, trạng thái tốt |
| `success-bg` | `#EAF8EF` | |
| `warning` | `#B45309` | Lưu ý, cần xác minh (đậm hơn vàng chuẩn để đạt tương phản 5,0:1) |
| `warning-bg` | `#FFF6E5` | |
| `error` | `#DC2626` | Lỗi, 👎 |
| `error-bg` | `#FDECEC` | |

### 2.2 Màu phân khúc (cố định mọi nơi: tag, biểu đồ, viền thẻ)

| Phân khúc | Màu | Nền nhạt | Icon (lucide / @ant-design/icons) |
|---|---|---|---|
| Văn phòng – Học tập | `#0369A1` | `#E6F4FB` | `Briefcase` |
| Mỏng nhẹ – Di động | `#0F766E` | `#E6F6F4` | `Feather` |
| Gaming | `#C2410C` | `#FDEFE7` | `Gamepad2` |
| Đồ họa – Kỹ thuật | `#9333EA` | `#F4EAFD` | `Palette` |

> Đã kiểm: chữ trắng trên 4 màu phân khúc đạt 5,2–5,9:1; chữ màu phân khúc trên nền nhạt tương ứng đạt ≥ 4,6:1. `primary-500` trên trắng đạt 4,51:1 (vừa đủ AA) — chữ nhỏ trên nền `primary-50` dùng `primary-700` (8,4:1). Không dùng chữ trắng trên `ai-500` (chỉ ~2,4:1) — chữ trên gradient AI phải đậm và cỡ ≥ 14 px, hoặc dùng chữ `primary-700` trên `primary-50`.

### 2.3 Bảng màu biểu đồ (Recharts)
Chuỗi mặc định: `#1A73E8, #06B6D4, #0F766E, #C2410C, #9333EA, #64748B`. Radar: hồ sơ lý tưởng nét đứt `#06B6D4` fill 15%; máy đang xem nét liền `#1A73E8` fill 25%.

## 3. Chữ

- Font: **Be Vietnam Pro** (Google Fonts, 400/500/600/700), fallback `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Số liệu (giá, điểm): `font-variant-numeric: tabular-nums` để cột thẳng hàng.

| Kiểu | Cỡ / dòng | Độ đậm | Dùng |
|---|---|---|---|
| Display | 36/44 | 700 | Hero trang chủ |
| H1 | 28/36 | 700 | Tiêu đề trang |
| H2 | 22/30 | 600 | Tiêu đề khối |
| H3 | 18/26 | 600 | Tiêu đề thẻ |
| Body | 15/24 | 400 | Nội dung |
| Body-strong | 15/24 | 600 | Giá, nhãn quan trọng |
| Small | 13/20 | 400 | Chú thích, thông số phụ |
| Price-lg | 24/32 | 700 | Giá trên thẻ kết quả, màu `primary-700` |

## 4. Khoảng cách, bo góc, đổ bóng

- Lưới 4 px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Bo góc: nút/input `10`, thẻ `16`, modal `20`, tag `999` (viên thuốc).
- Bóng (tông xanh, không xám đen):
  - `shadow-sm`: `0 1px 2px rgba(26,115,232,0.06)`
  - `shadow-md`: `0 4px 16px rgba(26,115,232,0.08)` — thẻ mặc định
  - `shadow-lg`: `0 12px 32px rgba(26,115,232,0.14)` — thẻ hover, modal
- Chuyển động: 180 ms `cubic-bezier(0.2, 0, 0, 1)`; thẻ hover nhấc `translateY(-2px)`. Tôn trọng `prefers-reduced-motion`.

## 5. Theme Ant Design

```ts
// src/theme/antdTheme.ts
import type { ThemeConfig } from 'antd';
import { t } from './tokens';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: t.primary500,
    colorInfo: t.primary500,
    colorSuccess: t.success,
    colorWarning: t.warning,
    colorError: t.error,
    colorBgLayout: t.bgPage,
    colorBgContainer: t.bgSurface,
    colorBorder: t.borderStrong,
    colorBorderSecondary: t.border,
    colorText: t.textPrimary,
    colorTextSecondary: t.textSecondary,
    fontFamily: `'Be Vietnam Pro', 'Segoe UI', Roboto, Arial, sans-serif`,
    fontSize: 15,
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadow: t.shadowMd,
  },
  components: {
    Layout: { headerBg: '#FFFFFF', siderBg: '#FFFFFF', bodyBg: t.bgPage },
    Menu: { itemSelectedBg: t.primary50, itemSelectedColor: t.primary700, itemBorderRadius: 10 },
    Card: { paddingLG: 24 },
    Button: { primaryShadow: '0 4px 12px rgba(26,115,232,0.25)', fontWeight: 600 },
    Slider: { trackBg: t.primary500, handleColor: t.primary500, railBg: t.primary100 },
    Steps: { colorPrimary: t.primary500 },
    Table: { headerBg: t.bgSubtle, headerColor: t.textSecondary, rowHoverBg: t.primary50 },
    Tag: { borderRadiusSM: 999 },
  },
};
```
Bọc `<ConfigProvider theme={antdTheme} locale={viVN}>` + `dayjs.locale('vi')`.

## 6. Bố cục

### 6.1 Khu vực khách hàng (top navigation)
```
┌──────────────────────────────────────────────────────────────────┐
│ [logo SmartLap]  Tư vấn  Danh mục  So sánh (2)      ♡  [Đăng nhập] │  64 px, nền trắng, viền dưới border
├──────────────────────────────────────────────────────────────────┤
│                    nội dung, max-width 1200 px                    │  nền bg-page
└──────────────────────────────────────────────────────────────────┘
```
### 6.2 Khu vực quản trị (sidebar)
Sider trắng 240 px (thu gọn 72 px), menu nhóm: **Tổng quan** (Dashboard) · **Dữ liệu** (Laptop, Hàng đợi nhãn, Benchmark) · **Trí tuệ** (Mô hình, Phản hồi, Cấu hình tri thức) · **Hệ thống** (Người dùng, Nhật ký). Nhóm "Trí tuệ" có icon ✨ để hội đồng thấy ngay phần thông minh.

### 6.3 Breakpoint
| Tên | Rộng | Lưới thẻ kết quả |
|---|---|---|
| xs | < 576 | 1 cột, wizard toàn màn |
| md | 768 | 2 cột |
| lg | 992 | 2 cột + cột phải radar dính |
| xl | ≥ 1200 | 3 cột danh mục, kết quả 2 cột + panel |

## 7. Thành phần đặc trưng

### 7.1 `AiBadge`
Viên thuốc gradient AI, chữ trắng 13/600, icon ✨ `Sparkles`: "AI gợi ý". Tooltip: "Kết quả do mô hình kNN tính từ nhu cầu của bạn".

### 7.2 `MatchScore`
Vòng tròn 64 px (AntD `Progress type="circle"`), stroke = gradient AI, số `91%` 18/700 ở giữa, chữ dưới "Phù hợp". Mức: ≥ 85 "Rất phù hợp", 70–84 "Phù hợp", < 70 "Tạm phù hợp".

### 7.3 `SegmentTag`
Tag viên thuốc nền nhạt + chữ màu phân khúc + icon (bảng 2.2).

### 7.4 `RecommendationCard`
```
┌───────────────────────────────────────────────────────┐
│ #1  [AiBadge]                      [MatchScore 91%]   │
│ ┌────────┐  ASUS TUF Gaming F15                        │
│ │ ảnh    │  [Gaming]  [💎 Đáng tiền nhất]              │
│ │ 4:3    │  19.990.000 ₫                               │
│ └────────┘  i5-12500H · RTX 3050 · 16GB · 512GB · 2,2kg│
│ ✅ Có card rời RTX 3050 — chơi game tốt                 │
│ ✅ Rẻ hơn ngân sách tối đa 2.010.000 ₫                  │
│ ⚠️ Nặng 2,2 kg, hơn mức mong muốn 0,2 kg               │
│ [Vì sao gợi ý?]  [+ So sánh]  [Chi tiết]    👍  👎     │
└───────────────────────────────────────────────────────┘
```
- Thẻ #1 có viền trên 3 px gradient AI; thẻ khác viền `border`.
- Điểm mạnh: icon `CheckCircle` `success`; lưu ý: `AlertTriangle` `warning`. Nền dòng không tô, chỉ icon màu.
- 👍/👎: nút ghost tròn 36 px; sau khi bấm → tô màu + toast "Cảm ơn bạn! Phản hồi giúp hệ thống gợi ý tốt hơn."
- Máy ghim: nhãn xám "Đề xuất từ cửa hàng", **không** có AiBadge.

### 7.5 `ExplainDrawer` ("Vì sao gợi ý?")
Drawer phải 480 px: radar lý tưởng vs máy; bảng "Đặc trưng | Bạn cần | Máy này | Mức lệch" (thanh ngang nhỏ); khối "Phân khúc được chọn vì…" liệt kê láng giềng bỏ phiếu; dòng cuối chữ nhỏ: "Mô hình kNN phiên bản clf-2026.10.05-01".

### 7.6 `PrioritySlider`
Nhãn trái (icon + tên), Slider 1–5 có mốc chữ: 1 "Không quan trọng", 3 "Bình thường", 5 "Rất quan trọng". Giá trị hiển thị bằng chấm tròn tô dần.

### 7.7 `FallbackBanner`
Alert `type="warning"` đầu danh sách: "Hệ thống AI đang bảo trì, kết quả được sắp xếp theo hiệu năng/giá. Bạn vẫn có thể xem và so sánh bình thường."

### 7.8 `ConfidenceIndicator` (quản trị)
Thanh ngang 4 đoạn màu phân khúc tỷ lệ theo xác suất; < 0,6 → tag `warning` "Cần xác minh".

## 8. Trạng thái bắt buộc

| Trạng thái | Cách hiển thị | Câu chữ mẫu |
|---|---|---|
| Đang tải kết quả | Skeleton 3 thẻ + dòng chữ luân phiên | "Đang so sánh 312 mẫu laptop…", "Đang tìm máy gần nhu cầu của bạn…" |
| Rỗng (không máy nào) | Minh họa + 2 gợi ý hành động | "Chưa có máy khớp mọi điều kiện. Thử nới ngân sách hoặc bỏ bớt yêu cầu bắt buộc." |
| Đã nới ngân sách | Alert info | "Chỉ có 2 máy trong ngân sách nên hệ thống đã mở rộng thêm 10%." |
| Dự phòng | `FallbackBanner` | (7.7) |
| Lỗi mạng | Result + nút "Thử lại" | "Không kết nối được máy chủ. Kiểm tra mạng và thử lại." |
| Không quyền | Result 403 | "Bạn không có quyền truy cập trang này." |

## 9. Câu chữ (microcopy)

- Xưng hô "bạn", giọng thân thiện, ngắn. Tránh thuật ngữ ở khu khách hàng: dùng "độ phù hợp" thay "khoảng cách", "máy tương tự" thay "láng giềng". Khu quản trị được dùng thuật ngữ (k, macro-F1, láng giềng).
- Nút: động từ + đối tượng: "Tìm laptop cho tôi", "Xem kết quả", "Duyệt đưa vào sử dụng".
- Số: `19.990.000 ₫`, `2,2 kg`, `15,6 inch`, `91%`. Giá rút gọn trên biểu đồ: `20 tr`.

## 10. Quy tắc code giao diện

- Token ở `src/theme/tokens.ts`, xuất cả dạng CSS variable ở `src/theme/global.css` (`--primary-500` …).
- ESLint cấm hex trong `.tsx`:
```js
// .eslintrc.cjs
rules: {
  'no-restricted-syntax': ['warn', {
    selector: "Literal[value=/^#([0-9a-fA-F]{3}){1,2}$/]",
    message: 'Không hardcode mã màu — dùng token trong src/theme/tokens.ts',
  }],
}
```
- Component dùng chung ở `src/components/smart/` (AiBadge, MatchScore, SegmentTag, RecommendationCard, ExplainDrawer, PrioritySlider, FallbackBanner, ConfidenceIndicator).
- Định dạng ở `src/utils/format.ts`: `formatVnd`, `formatShortVnd`, `formatKg`, `formatPct`.

## 11. Truy cập (a11y)
- Tương phản ≥ 4,5:1 cho chữ thường, kiểm bằng công cụ tương phản trước khi chốt màu mới.
- Không truyền thông tin chỉ bằng màu: điểm mạnh/lưu ý luôn có icon; phân khúc luôn có chữ.
- Focus ring `0 0 0 3px primary-200` trên mọi phần tử tương tác; wizard dùng được bằng bàn phím.
- Ảnh laptop có `alt` = tên máy.

## 12. Checklist duyệt UI trước khi merge
- [ ] Không có hex trong `.tsx` (ESLint sạch)
- [ ] Đủ 4 trạng thái: tải / rỗng / lỗi / dự phòng
- [ ] Chuỗi 100% tiếng Việt có dấu, số định dạng vi-VN
- [ ] Hiển thị đúng ở 375 px và 1440 px
- [ ] Yếu tố AI có AiBadge hoặc viền xanh lơ + có đường vào "Vì sao?"
- [ ] Một nút chính duy nhất mỗi màn
- [ ] Màu phân khúc đúng bảng 2.2
