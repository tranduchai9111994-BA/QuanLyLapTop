import { Slider } from 'antd';
import type { ReactNode } from 'react';
import { t } from '../../theme/tokens';

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
      <Slider
        min={1}
        max={5}
        value={value}
        onChange={onChange}
        marks={{ 1: 'Không quan trọng', 3: 'Bình thường', 5: 'Rất quan trọng' }}
        tooltip={{ formatter: (v) => `${v}/5` }}
      />
    </div>
  );
}
