import { BankOutlined, BgColorsOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { segmentColors } from '../../theme/tokens';

const ICONS: Record<string, ReactNode> = {
  OFFICE: <BankOutlined />,
  ULTRABOOK: <RocketOutlined />,
  GAMING: <ThunderboltOutlined />,
  CREATOR: <BgColorsOutlined />,
};

/** Dai dien hinh anh cho laptop: dung anh that neu co (`imageUrl`), neu khong (hien tai toan bo
 * catalog mo phong deu chua co anh that) thi hien khoi mau + icon theo phan khuc thay vi de trong
 * - tranh cam giac "chi co chu", van trung thuc (khong bia anh san pham gia). */
export function LaptopThumbnail({
  imageUrl,
  segment,
  name,
  height = 120,
}: {
  imageUrl?: string | null;
  segment?: string;
  name: string;
  height?: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{ width: '100%', height, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }}
      />
    );
  }
  const cfg = segmentColors[segment ?? 'OFFICE'] ?? segmentColors.OFFICE;
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        marginBottom: 8,
        background: cfg.bg,
        color: cfg.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: height * 0.35,
      }}
      aria-hidden
    >
      {ICONS[segment ?? 'OFFICE']}
    </div>
  );
}
