import { Slider } from 'antd';
import type { ReactNode } from 'react';
import { t } from '../../theme/tokens';

/** Thanh truot 1-5 dung cho 4 muc uu tien (Hieu nang/Di dong/Man hinh/Tiet kiem) trong Wizard -
 * gia tri nay duoc gui thang len backend lam `priorities` de tinh trong so trong metric kNN cua
 * Mo hinh B (xem retriever.build_weights - GIAI_THICH_THUAT_TOAN_KNN.md muc 4.2 buoc 2). */
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
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: t.textPrimary, fontWeight: 600 }}>
        {icon} {label}
      </div>
      {/* Nhan RAT NGAN: nhan dai ("Rat quan trong") bi xuong 3 dong va de len thanh truot ke duoi */}
      <Slider
        min={1}
        max={5}
        value={value}
        onChange={onChange}
        marks={{ 1: 'Ít', 3: 'Vừa', 5: 'Cao' }}
        tooltip={{ formatter: (v) => `${v}/5` }}
        style={{ marginBottom: 20 }}
      />
    </div>
  );
}
