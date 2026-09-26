import { Progress } from 'antd';
import { t } from '../../theme/tokens';

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
