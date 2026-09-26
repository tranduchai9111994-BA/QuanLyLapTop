import { BankOutlined, RocketOutlined, ThunderboltOutlined, BgColorsOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { segmentColors } from '../../theme/tokens';

const ICONS: Record<string, ReactNode> = {
  OFFICE: <BankOutlined />,
  ULTRABOOK: <RocketOutlined />,
  GAMING: <ThunderboltOutlined />,
  CREATOR: <BgColorsOutlined />,
};

export function SegmentTag({ segment }: { segment: string }) {
  const cfg = segmentColors[segment] ?? segmentColors.OFFICE;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 12px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {ICONS[segment]} {cfg.label}
    </span>
  );
}
