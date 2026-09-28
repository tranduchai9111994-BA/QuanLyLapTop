import { Button, Modal, Radio, Space, Tag, message } from 'antd';
import { LikeOutlined, DislikeOutlined, LikeFilled, DislikeFilled } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecommendationItemDto } from '../../types';
import { AiBadge } from './AiBadge';
import { MatchScore } from './MatchScore';
import { SegmentTag } from './SegmentTag';
import { LaptopThumbnail } from './LaptopThumbnail';
import { DiscountBadge } from './DiscountBadge';
import { t } from '../../theme/tokens';
import { formatVnd, formatKg } from '../../utils/format';
import { explainText } from '../../utils/explainText';
import { api } from '../../lib/api';

// Ly do "Khong thich" (FR-04) - khop voi enum `reason` phia backend (events.routes.ts) va
// duoc dung lam du lieu hoc them trong retrain_from_feedback.py o ml-service.
const DISLIKE_REASONS: { value: string; label: string }[] = [
  { value: 'TOO_EXPENSIVE', label: 'Giá quá cao' },
  { value: 'TOO_HEAVY', label: 'Máy quá nặng/cồng kềnh' },
  { value: 'WEAK_PERFORMANCE', label: 'Cấu hình yếu' },
  { value: 'POOR_DISPLAY', label: 'Màn hình không như ý' },
  { value: 'BRAND', label: 'Không thích thương hiệu' },
  { value: 'OTHER', label: 'Lý do khác' },
];

/** The hien thi 1 may trong danh sach "Ket qua goi y" (Results.tsx) - gom anh, gia + khuyen mai,
 * 2 diem manh/canh bao noi bat nhat, nut Vi sao/So sanh/Chi tiet, va nut Thich/Khong thich de
 * ghi lai phan hoi (dung cho "hoc tu phan hoi" - xem retrain_from_feedback trong ml-service).
 * `badges`: nhan phu (FR-02) do Results.tsx TINH TU TAP KET QUA DANG HIEN (khong dung nguong
 * co dinh nhu valueIdx > X), vd "Nhe nhat"/"Manh nhat"/"Dang tien nhat" trong top may dang xem. */
export function RecommendationCard({
  item,
  sessionId,
  badges,
  onExplain,
  onCompareToggle,
  isComparing,
}: {
  item: RecommendationItemDto;
  sessionId: string;
  badges?: string[];
  onExplain: () => void;
  onCompareToggle: () => void;
  isComparing: boolean;
}) {
  const navigate = useNavigate();
  const laptop = item.laptop;
  const isTop1 = item.rank === 1;
  // docs/08_FRONTEND_SPEC.md muc 4: "khong cho bam lap (khoa theo sessionId+laptopId)" - luu vao
  // localStorage (khong chi state trong bo nho) de khoa nay GIU NGUYEN ca khi nguoi dung tai lai
  // trang (vd bam F5 sau khi da 👍), tranh ghi trung nhieu su kien LIKE/DISLIKE cho CUNG 1 may
  // trong CUNG 1 phien tu van.
  const feedbackKey = `smartlap_feedback_${sessionId}_${laptop.id}`;
  const [feedback, setFeedback] = useState<'LIKE' | 'DISLIKE' | null>(() => {
    try {
      return (localStorage.getItem(feedbackKey) as 'LIKE' | 'DISLIKE' | null) ?? null;
    } catch {
      return null;
    }
  });
  const [reasonPickerOpen, setReasonPickerOpen] = useState(false);
  const [reason, setReason] = useState<string>('TOO_EXPENSIVE');

  /** Ghi lai 1 su kien phan hoi - LUU Y: cap nhat giao dien (setFeedback) NGAY LAP TUC truoc khi
   * cho ket qua goi API (optimistic update), vi day chi la telemetry phu, khong bat buoc thanh
   * cong ngay lap tuc thi trai nghiem nguoi dung moi lam. Neu goi API loi thi im lang bo qua
   * (khong hien thong bao loi) - khong nen lam gian doan nguoi dung vi 1 thao tac phu nhu the nay. */
  async function sendFeedback(type: 'LIKE' | 'DISLIKE', extra?: { reason?: string }) {
    setFeedback(type);
    try {
      localStorage.setItem(feedbackKey, type);
    } catch {
      // localStorage co the bi chan (che do an danh) - khong sao, chi mat tinh nang khoa qua lan tai lai
    }
    try {
      await api.post('/events', { sessionId, laptopId: laptop.id, type, ...extra });
      message.success('Cảm ơn bạn! Phản hồi giúp hệ thống gợi ý tốt hơn.');
    } catch {
      // im lang - khong lam gian doan trai nghiem
    }
  }

  function handleDislikeClick() {
    if (feedback) return;
    setReasonPickerOpen(true);
  }

  function confirmDislike() {
    setReasonPickerOpen(false);
    sendFeedback('DISLIKE', { reason });
  }

  return (
    <div
      style={{
        // `minWidth: 0`: the outer div here IS a CSS grid item (Results.tsx renders these
        // directly inside a `display:grid` list) - grid items, like flex items, default to
        // `min-width: auto` and refuse to shrink below their content's min-content size unless
        // told otherwise. The inner flex rows already declare `minWidth: 0` so THEIR own text
        // can wrap/shrink, but without it HERE too the whole card still can't go narrower than
        // (thumbnail 128px + match-score circle 64px + paddings/gaps), pushing the page into
        // horizontal overflow on narrow screens (found testing NFR-04 at 375px in Giai đoạn 7).
        minWidth: 0,
        background: t.bgSurface,
        borderRadius: 16,
        border: isTop1 ? `3px solid transparent` : `1px solid ${t.border}`,
        backgroundImage: isTop1 ? `linear-gradient(white, white), ${t.aiGradient}` : undefined,
        backgroundOrigin: 'border-box',
        backgroundClip: isTop1 ? 'padding-box, border-box' : undefined,
        boxShadow: t.shadowMd,
        padding: 16,
      }}
    >
      {/* Bo cuc NGANG: anh ben trai, thong tin ben phai (docs/07 SS7.4) - truoc day anh keo dai
          het chieu ngang the nen thua rat nhieu khoang trong. */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* flexShrink:0 - anh la KICH THUOC CO DINH co chu y (128x96), khong muon no tu bop nho
            lai truoc khi noi dung ben canh (ten/gia/thong so) kip wrap xuong dong; neu khong co
            dong nay, tren man hep ca anh LAN chu deu bi ep nho lai dong thoi, cang de gay tran. */}
        <div style={{ flexShrink: 0 }}>
          <LaptopThumbnail
            imageUrl={laptop.imageUrl}
            segment={laptop.segmentLabel?.segment}
            brand={laptop.brand?.name}
            name={laptop.name}
            width={128}
            height={96}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700 }}>#{item.rank}</span>
                {/* isPinned: may nay duoc CUA HANG chu dong "ghim" uu tien (khong phai kNN chon)
                    - vd may dang can day hang/co khuyen mai dac biet - phai ghi ro nguon goc
                    khac nhau de khong nham lan voi goi y THAT cua thuat toan */}
                {!item.isPinned && <AiBadge />}
                {item.isPinned && <Tag>Đề xuất từ cửa hàng</Tag>}
              </div>
              <h3 style={{ margin: '2px 0' }}>{laptop.name}</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                {laptop.segmentLabel && <SegmentTag segment={laptop.segmentLabel.segment} />}
                {badges?.map((b) => (
                  <Tag color="gold" key={b}>
                    {b}
                  </Tag>
                ))}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.primary700 }} className="tabular-nums">
                {formatVnd(laptop.priceVnd)}
              </div>
              <DiscountBadge
                priceVnd={laptop.priceVnd}
                originalPriceVnd={laptop.originalPriceVnd}
                salesCount={laptop.salesCount}
              />
              <div style={{ color: t.textSecondary, fontSize: 13 }}>
                {laptop.cpu.displayName} · {laptop.gpu.displayName} · {laptop.ramGb}GB · {laptop.ssdGb}GB ·{' '}
                {formatKg(laptop.weightKg)}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <MatchScore pct={item.matchPct} />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            {item.explanation.strengths.slice(0, 2).map((s, i) => (
              <div key={i} style={{ color: t.success, fontSize: 14, marginBottom: 2 }}>
                ✅ {explainText(s)}
              </div>
            ))}
            {item.explanation.warnings.map((w, i) => (
              <div key={i} style={{ color: t.warning, fontSize: 14, marginBottom: 2 }}>
                ⚠️ {explainText(w)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={onExplain}>
            Vì sao gợi ý?
          </Button>
          <Button size="small" onClick={onCompareToggle} type={isComparing ? 'primary' : 'default'}>
            {isComparing ? '✓ Đang so sánh' : '+ So sánh'}
          </Button>
          <Button size="small" onClick={() => navigate(`/laptop/${laptop.id}`)}>
            Chi tiết
          </Button>
        </div>
        <div>
          <Button
            shape="circle"
            disabled={!!feedback}
            icon={feedback === 'LIKE' ? <LikeFilled /> : <LikeOutlined />}
            onClick={() => sendFeedback('LIKE')}
            style={{ marginRight: 4, color: feedback === 'LIKE' ? t.success : undefined }}
            title={feedback ? 'Bạn đã gửi phản hồi cho máy này' : 'Thích'}
          />
          <Button
            shape="circle"
            disabled={!!feedback}
            icon={feedback === 'DISLIKE' ? <DislikeFilled /> : <DislikeOutlined />}
            onClick={handleDislikeClick}
            style={{ color: feedback === 'DISLIKE' ? t.error : undefined }}
            title={feedback ? 'Bạn đã gửi phản hồi cho máy này' : 'Không thích'}
          />
        </div>
      </div>

      {/* FR-04: khi bam "Khong thich", hoi RO ly do thay vi chi ghi 1 su kien chung chung - du
          lieu nay dung de UC-15 (Phan tich phan hoi) thong ke nguyen nhan pho bien nhat. */}
      <Modal
        title="Vì sao bạn không thích máy này?"
        open={reasonPickerOpen}
        onCancel={() => setReasonPickerOpen(false)}
        onOk={confirmDislike}
        okText="Gửi phản hồi"
        cancelText="Bỏ qua"
      >
        <Radio.Group value={reason} onChange={(e) => setReason(e.target.value)}>
          <Space direction="vertical">
            {DISLIKE_REASONS.map((r) => (
              <Radio key={r.value} value={r.value}>
                {r.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
}
