import { segmentColors } from '../../theme/tokens';

/**
 * Anh dai dien cho laptop, uu tien theo thu tu:
 *   1. `imageUrl` that (tu nha ban le, khi co du lieu thuc te)
 *   2. Anh THAT tham khao theo HANG (chi 5 hang co san qua API cong khai DummyJSON:
 *      Apple/Asus/Huawei/Lenovo/Dell) - la anh may cua chinh hang do, KHONG phai dung model
 *      dang hien, nen chi dung nhu "anh minh hoa theo hang" (co ghi chu nho).
 *   3. Minh hoa ve tay theo phong cach anh chup (goc nghieng, man hinh co bong sang) cho cac
 *      hang CHUA CO anh that (Acer, HP, MSI, LG, Gigabyte, Masstel, Avita) - tranh gan anh that
 *      cua mot model cu the len mot may MO PHONG khong co that, gay hieu nham voi nguoi xem.
 */
const BRAND_PHOTO: Record<string, string> = {
  Apple: '/brand-photos/apple.webp',
  ASUS: '/brand-photos/asus.webp',
  Huawei: '/brand-photos/huawei.webp',
  Lenovo: '/brand-photos/lenovo.webp',
  Dell: '/brand-photos/dell.webp',
};

const BRAND_ACCENT: Record<string, string> = {
  Apple: '#555555',
  Dell: '#0076CE',
  Lenovo: '#E1140A',
  HP: '#0096D6',
  ASUS: '#00539B',
  Acer: '#83B81A',
  MSI: '#FF0000',
  LG: '#A50034',
  Gigabyte: '#F58220',
  Huawei: '#CF0A2C',
  Masstel: '#0F6FC5',
  Avita: '#7B2D8E',
};

function brandShort(brand?: string): string {
  if (!brand) return 'LAP';
  return brand.length <= 4 ? brand.toUpperCase() : brand.slice(0, 4).toUpperCase();
}

export function LaptopThumbnail({
  imageUrl,
  segment,
  brand,
  name,
  height = 120,
  width,
  showBrandPhotoNote = false,
}: {
  imageUrl?: string | null;
  segment?: string;
  brand?: string;
  name: string;
  height?: number;
  width?: number | string;
  /** Hien dong chu nho "anh minh hoa" duoi anh that theo hang - dung o trang Chi tiet, tat o the nho. */
  showBrandPhotoNote?: boolean;
}) {
  const boxStyle = {
    width: width ?? '100%',
    height,
    borderRadius: 12,
    objectFit: 'cover' as const,
    display: 'block' as const,
  };

  const realPhoto = imageUrl || (brand ? BRAND_PHOTO[brand] : undefined);
  if (realPhoto) {
    return (
      <div style={{ width: width ?? '100%' }}>
        <img src={realPhoto} alt={name} style={boxStyle} />
        {showBrandPhotoNote && !imageUrl && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, textAlign: 'center' }}>
            Ảnh minh họa theo hãng {brand}
          </div>
        )}
      </div>
    );
  }

  const seg = segmentColors[segment ?? 'OFFICE'] ?? segmentColors.OFFICE;
  const accent = BRAND_ACCENT[brand ?? ''] ?? seg.color;
  const label = brandShort(brand);
  const gradId = `scr-${(brand ?? 'x').replace(/\s+/g, '')}`;

  return (
    <svg
      viewBox="0 0 200 150"
      role="img"
      aria-label={`Ảnh minh họa ${name}`}
      style={{ ...boxStyle, background: `linear-gradient(180deg, ${seg.bg} 0%, #FFFFFF 100%)` }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${gradId}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8ECF2" />
          <stop offset="100%" stopColor="#C7CFDA" />
        </linearGradient>
      </defs>

      {/* Bong do duoi may - tao cam giac may dang dat tren mat ban, giong anh chup that */}
      <ellipse cx="100" cy="132" rx="72" ry="6" fill="#0F1B2D" opacity="0.10" />

      {/* Day may (perspective nghieng nhe) */}
      <path d="M28 100 L172 100 L184 122 L16 122 Z" fill={`url(#${gradId}-body)`} stroke="#B7C0CC" strokeWidth="1" />
      <rect x="86" y="108" width="28" height="4" rx="2" fill="#9AA5B1" />

      {/* Man hinh */}
      <path d="M40 24 L160 24 L164 100 L36 100 Z" fill="#151B24" />
      <path d="M45 30 L155 30 L158 94 L42 94 Z" fill={`url(#${gradId})`} />

      {/* "Anh nen" man hinh: vai duong cong nhu wallpaper, khong phai icon phang */}
      <path d="M42 94 L70 60 L95 80 L118 50 L158 94 Z" fill="#FFFFFF" opacity="0.18" />

      <text
        x="100"
        y="66"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="'Be Vietnam Pro', Arial, sans-serif"
        letterSpacing="1"
      >
        {label}
      </text>
    </svg>
  );
}
