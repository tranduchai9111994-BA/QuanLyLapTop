import { Tag } from 'antd';
import { t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

/**
 * Hien thi khuyen mai (gia goc gach ngang + % giam) va luot ban cua 1 may.
 *
 * Day la phan HIEN THI cho phan da duoc dua vao Mo hinh B lam dac trung xep hang thuc su
 * (xem ml-service/app/retriever.py, nhom "popularity": discount_percent + sales_score) -
 * khong chi la trang tri, ma phan anh dung ly do vi sao mot may co the duoc xep hang cao hon
 * du gia hien tai khong phai la re nhat.
 *
 * - `originalPriceVnd` null/undefined hoac <= priceVnd => may KHONG dang giam gia, khong hien gi.
 * - `salesCount` > 0 => hien badge "Da ban N" (lam tron cho de doc: 1.234 -> "Da ban 1.234").
 */
export function DiscountBadge({
  priceVnd,
  originalPriceVnd,
  salesCount,
  size = 'default',
}: {
  priceVnd: number;
  originalPriceVnd?: number | null;
  salesCount?: number;
  size?: 'default' | 'small';
}) {
  const onSale = !!originalPriceVnd && originalPriceVnd > priceVnd;
  const discountPct = onSale
    ? Math.round(((originalPriceVnd! - priceVnd) / originalPriceVnd!) * 100)
    : 0;
  const fontSize = size === 'small' ? 12 : 13;

  if (!onSale && !salesCount) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
      {onSale && (
        <>
          <span
            style={{
              color: t.textSecondary,
              fontSize,
              textDecoration: 'line-through',
            }}
            className="tabular-nums"
          >
            {formatVnd(originalPriceVnd!)}
          </span>
          <Tag color="red" style={{ fontSize, lineHeight: '18px', margin: 0 }}>
            -{discountPct}%
          </Tag>
        </>
      )}
      {!!salesCount && salesCount > 0 && (
        <span style={{ color: t.textSecondary, fontSize }}>
          Đã bán {salesCount.toLocaleString('vi-VN')}
        </span>
      )}
    </div>
  );
}
