import { Tooltip } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { t } from '../../theme/tokens';

/** Nhan nho "AI goi y" gan tren the ket qua - phan biet ro voi may do CUA HANG tu chon
 * (xem `isPinned` trong RecommendationCard.tsx), giup nguoi dung biet dau la goi y THAT cua kNN. */
export function AiBadge() {
  return (
    <Tooltip title="Kết quả do mô hình kNN tính từ nhu cầu của bạn">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 10px',
          borderRadius: 999,
          background: t.aiGradient,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <StarFilled style={{ fontSize: 12 }} /> AI gợi ý
      </span>
    </Tooltip>
  );
}
