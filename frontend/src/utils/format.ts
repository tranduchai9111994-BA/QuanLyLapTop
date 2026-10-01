/** Cac ham dinh dang so lieu hien thi cho nguoi dung Viet Nam (tien te, don vi kg/inch/%).
 * Moi ham deu tra ve "—" khi gia tri null/undefined - tranh hien "NaN" hay "undefined" tren
 * man hinh khi du lieu con thieu (vd may chua co pin/gia). */
export function formatVnd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/** Số thường có dấu ngăn cách hàng nghìn kiểu Việt Nam: 17180000 -> "17.180.000", 1.5 -> "1,5".
 * Dùng cho số không phải tiền (điểm benchmark, RAM...) hoặc bảng trộn nhiều đơn vị. */
export function formatNumber(n: number | null | undefined, maxFractionDigits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: maxFractionDigits });
}

export function formatShortVnd(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `${Math.round(amount / 1_000_000)} tr`;
}

export function formatKg(kg: number | null | undefined): string {
  if (kg == null) return '—';
  return `${kg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg`;
}

export function formatPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v)}%`;
}

export function formatInch(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} inch`;
}
