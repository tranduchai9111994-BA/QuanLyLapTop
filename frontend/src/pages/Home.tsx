import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme/tokens';

export function Home() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 900, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          lineHeight: '44px',
          backgroundImage: t.aiGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 16,
        }}
      >
        Tìm laptop phù hợp với bạn bằng AI
      </div>
      <p style={{ fontSize: 17, color: t.textSecondary, marginBottom: 32 }}>
        Trả lời vài câu hỏi về nhu cầu và ngân sách — hệ thống dùng kNN để gợi ý những chiếc laptop
        gần nhất với hồ sơ lý tưởng của bạn, kèm giải thích rõ ràng vì sao mỗi máy được chọn.
      </p>
      <Button type="primary" size="large" onClick={() => navigate('/wizard')}>
        Tìm laptop cho tôi
      </Button>
    </div>
  );
}
