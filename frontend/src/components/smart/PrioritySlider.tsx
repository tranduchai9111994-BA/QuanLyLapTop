import { Slider } from 'antd';
import type { ReactNode } from 'react';
import { t } from '../../theme/tokens';

/** Thanh truot 1-5 dung cho 4 muc uu tien (Hieu nang/Di dong/Man hinh/Tiet kiem) trong Wizard -
 * gia tri nay duoc gui thang len backend lam `priorities` de tinh trong so trong metric kNN cua
 * Mo hinh B (xem retriever.build_weights - docs/13_GIAI_THICH_THUAT_TOAN_KNN.md muc 4.2 buoc 2). */
export function PrioritySlider({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    // marginBottom 36 (thay vi 20 truoc day): docs/07_UIUX.md muc 7.6 yeu cau nguyen van 3 nhan
    // "Khong quan trong / Binh thuong / Rat quan trong" (dai hon nhieu "It/Vua/Cao" da dung tam
    // truoc do de tranh xuong dong de len thanh truot ke tiep) - danh them khong gian doc de
    // nhan xuong 2 dong (o do rong ~340px cua sidebar Wizard) khong con chong len phan tu ben
    // duoi.
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: t.textPrimary, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <Slider
        min={1}
        max={5}
        value={value}
        onChange={onChange}
        marks={{
          1: { style: { fontSize: 12, width: 70 }, label: 'Không quan trọng' },
          3: { style: { fontSize: 12 }, label: 'Bình thường' },
          5: { style: { fontSize: 12, width: 70, marginLeft: -46 }, label: 'Rất quan trọng' },
        }}
        tooltip={{ formatter: (v) => `${v}/5` }}
        style={{ marginBottom: 8 }}
      />
    </div>
  );
}
