import { Button, Card } from 'antd';
import { BulbOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme/tokens';

const HIGHLIGHTS = [
  {
    icon: <BulbOutlined />,
    title: 'Nói bằng lời của bạn',
    desc: 'Chỉ cần gõ "con học kế toán, cần máy bền, rẻ" — hệ thống tự hiểu nhu cầu, không cần kéo từng thanh trượt.',
  },
  {
    icon: <ThunderboltOutlined />,
    title: 'kNN tìm máy gần nhu cầu nhất',
    desc: 'So sánh 1.000 máy theo hiệu năng, cân nặng, màn hình và giá để chọn ra 5 máy khớp nhất.',
  },
  {
    icon: <DollarOutlined />,
    title: 'Giải thích rõ vì sao',
    desc: 'Mỗi gợi ý đều nêu điểm mạnh và điểm cần lưu ý so với hồ sơ lý tưởng của bạn.',
  },
];

export function Home() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 1200, margin: '32px auto 48px', padding: '0 16px' }}>
      {/* Hero: anh minh hoa ben trai, loi keu goi ben phai - lap khoang trong hai ben */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <img
          src="/logo-full.png"
          alt="SmartLap — hệ khuyến nghị laptop bằng kNN"
          style={{ width: 'min(420px, 100%)', height: 'auto' }}
        />

        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              lineHeight: '44px',
              backgroundImage: t.aiGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 12,
            }}
          >
            Tìm laptop phù hợp với bạn bằng AI
          </div>
          <p style={{ fontSize: 17, color: t.textSecondary, marginBottom: 24 }}>
            Trả lời vài câu hỏi về nhu cầu và ngân sách — hệ thống dùng kNN để gợi ý những chiếc
            laptop gần nhất với hồ sơ lý tưởng của bạn, kèm giải thích rõ ràng vì sao mỗi máy được
            chọn.
          </p>
          <Button type="primary" size="large" onClick={() => navigate('/wizard')}>
            Tìm laptop cho tôi
          </Button>
          <Button size="large" style={{ marginLeft: 12 }} onClick={() => navigate('/laptops')}>
            Xem danh mục
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginTop: 40,
        }}
      >
        {HIGHLIGHTS.map((h) => (
          <Card key={h.title} size="small" styles={{ body: { padding: 20 } }}>
            <div style={{ fontSize: 24, color: t.primary500, marginBottom: 8 }}>{h.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{h.title}</div>
            <div style={{ color: t.textSecondary, fontSize: 14 }}>{h.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
