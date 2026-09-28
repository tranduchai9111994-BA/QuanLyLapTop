import { useEffect, useState } from 'react';
import { Button, Card, Skeleton } from 'antd';
import { BulbOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { t } from '../theme/tokens';
import { api } from '../lib/api';
import type { Laptop } from '../types';
import { LaptopThumbnail } from '../components/smart/LaptopThumbnail';
import { SegmentTag } from '../components/smart/SegmentTag';
import { formatVnd } from '../utils/format';

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

// docs/08_FRONTEND_SPEC.md muc 2: "Cach SmartLap hoat dong" - 3 BUOC theo dung THU TU quy trinh
// (khac voi 3 the HIGHLIGHTS o tren, von la 3 DIEM MANH cua he thong chu khong phai luong buoc -
// giu ca hai vi bo sung y nghia cho nhau, khong trung lap).
const STEPS = [
  { n: 1, title: 'Bạn cho biết nhu cầu', desc: 'Chọn mục đích sử dụng, ngân sách và mức ưu tiên — hoặc chỉ cần gõ 1 câu bằng lời của bạn.' },
  { n: 2, title: 'AI tìm máy gần nhất', desc: 'Mô hình kNN so sánh nhu cầu của bạn với toàn bộ catalog theo hiệu năng, di động, màn hình và giá.' },
  { n: 3, title: 'Bạn xem giải thích và chọn', desc: 'Mỗi gợi ý đều kèm lý do rõ ràng — bạn luôn là người quyết định cuối cùng.' },
];

export function Home() {
  const navigate = useNavigate();
  const [bestValue, setBestValue] = useState<Laptop[] | null>(null);

  useEffect(() => {
    // docs/08_FRONTEND_SPEC.md muc 2: dai "Dang tien nhat tuan nay" - 4 may co chi so hieu
    // nang/gia (value_index) cao nhat trong catalog, dung lai sort `value_desc` da co san o
    // backend (khong can API moi).
    api
      .get('/laptops?sort=value_desc&pageSize=4')
      .then((r) => setBestValue(r.data.data))
      .catch(() => setBestValue([]));
  }, []);

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

      {/* "Cach SmartLap hoat dong": 3 buoc noi tiep nhau, danh cho nguoi chua tung dung thu -
          khac 3 the tren (do la DIEM MANH, day la QUY TRINH). */}
      <h2 style={{ marginTop: 48, textAlign: 'center' }}>Cách SmartLap hoạt động</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        {STEPS.map((s) => (
          <div key={s.n} style={{ textAlign: 'center', padding: '0 12px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: t.aiGradient,
                color: t.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 20,
                margin: '0 auto 12px',
              }}
            >
              {s.n}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
            <div style={{ color: t.textSecondary, fontSize: 14 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* "Dang tien nhat tuan nay": 4 may value_index cao nhat - minh hoa cu the ngay tren trang
          chu, khong bat nguoi dung phai vao Danh muc moi thay he thong "biet" may nao dang tien. */}
      <h2 style={{ marginTop: 48 }}>💎 Đáng tiền nhất tuần này</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
        {bestValue === null
          ? [1, 2, 3, 4].map((i) => (
              <Card key={i} size="small">
                <Skeleton active avatar paragraph={{ rows: 2 }} />
              </Card>
            ))
          : bestValue.map((l) => (
              <Card key={l.id} hoverable size="small" onClick={() => navigate(`/laptop/${l.id}`)}>
                <LaptopThumbnail imageUrl={l.imageUrl} segment={l.segmentLabel?.segment} brand={l.brand?.name} name={l.name} height={110} />
                {l.segmentLabel && <div style={{ margin: '8px 0 4px' }}><SegmentTag segment={l.segmentLabel.segment} /></div>}
                <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
                  {formatVnd(l.priceVnd)}
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}
