import { Progress } from 'antd';
import { t } from '../../theme/tokens';

/** Vong tron % phu hop (`matchPct` tu backend, tinh boi retriever.match_pct() - xem
 * docs/13_GIAI_THICH_THUAT_TOAN_KNN.md muc 4.2) kem nhan chu de nguoi khong quen doc % cung hieu duoc
 * muc do phu hop. Nguong 85/70 la NGUONG HIEN THI don thuan (khong anh huong xep hang thuc su). */
export function MatchScore({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const label = pct >= 85 ? 'Rất phù hợp' : pct >= 70 ? 'Phù hợp' : 'Tạm phù hợp';
  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="circle"
        size={64}
        percent={Math.round(pct)}
        strokeColor={{ '0%': t.primary500, '100%': t.ai500 }}
        format={(p) => <span style={{ fontWeight: 700, fontSize: 18 }}>{p}%</span>}
      />
      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{label}</div>
    </div>
  );
}
