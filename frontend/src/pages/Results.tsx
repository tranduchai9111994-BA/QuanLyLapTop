import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Empty, Result, Segmented, Skeleton, Space, Spin } from 'antd';
import { RecommendationCard } from '../components/smart/RecommendationCard';
import { ExplainDrawer } from '../components/smart/ExplainDrawer';
import { FallbackBanner, BudgetRelaxedBanner } from '../components/smart/FallbackBanner';
import { LoadingMessages } from '../components/smart/LoadingMessages';
import { api } from '../lib/api';
import { t } from '../theme/tokens';
import type { RecommendationItemDto, RecommendationResult } from '../types';

// FR-02: cho phep xem 3-10 ket qua thay vi co dinh 5 - tang dan de tranh danh sach qua dai
// mac dinh nhung van du lua chon cho nguoi thich xem nhieu.
const TOPN_OPTIONS = [3, 5, 8, 10];

// docs/07_UIUX.md muc 8 "Dang tai ket qua": dong chu luan phien, KHONG phai 1 cau tinh.
const LOADING_MESSAGES = [
  'Đang so sánh 1.000 mẫu laptop…',
  'Đang tìm máy gần nhu cầu của bạn…',
  'Đang tính điểm phù hợp cho từng máy…',
];

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state as
    | { result?: RecommendationResult; requestBody?: Record<string, unknown> }
    | null;

  const [result, setResult] = useState(initialState?.result);
  const requestBody = initialState?.requestBody;
  const [topN, setTopN] = useState(requestBody?.topN as number ?? 5);
  const [reloading, setReloading] = useState(false);

  // Wizard.tsx nay CHUYEN TRANG NGAY khi bam "Xem ket qua" (khong doi API tra ve truoc), chi
  // truyen `requestBody` - man nay tu goi API luc mount va tu hien trang thai "dang tai" (Skeleton
  // + dong chu luan phien) trong luc cho, thay vi Wizard dung yen voi 1 vong xoay tren nut.
  const [initialLoading, setInitialLoading] = useState(!!requestBody && !initialState?.result);
  const [initialError, setInitialError] = useState(false);

  function loadInitial() {
    if (!requestBody) return;
    setInitialLoading(true);
    setInitialError(false);
    api
      .post<{ success: boolean; data: RecommendationResult }>('/recommendations', requestBody)
      .then((r) => setResult(r.data.data))
      .catch(() => setInitialError(true))
      .finally(() => setInitialLoading(false));
  }

  useEffect(() => {
    if (!requestBody || initialState?.result) return;
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [explainItem, setExplainItem] = useState<RecommendationItemDto | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  // FR-02: cac nhan "Nhe nhat/Manh nhat/Dang tien nhat" duoc tinh TU CHINH TAP KET QUA DANG
  // HIEN THI (top N may nguoi dung dang xem), khong dung nguong co dinh trong toan bo CSDL -
  // vi 1 may co the la "nhe nhat" trong nhom Gaming nhung binh thuong so voi Ultrabook.
  const badgesByLaptopId = useMemo(() => {
    if (!result || result.items.length < 2) return new Map<number, string[]>();
    const map = new Map<number, string[]>();
    const add = (id: number, label: string) => map.set(id, [...(map.get(id) ?? []), label]);

    const lightest = [...result.items].sort((a, b) => a.laptop.weightKg - b.laptop.weightKg)[0];
    add(lightest.laptopId, '🪶 Nhẹ nhất');

    const strongest = [...result.items].sort((a, b) => b.laptop.performanceIdx - a.laptop.performanceIdx)[0];
    add(strongest.laptopId, '⚡ Mạnh nhất');

    const bestValue = [...result.items].sort((a, b) => b.laptop.valueIdx - a.laptop.valueIdx)[0];
    add(bestValue.laptopId, '💎 Đáng tiền nhất');

    return map;
  }, [result]);

  if (initialLoading) {
    return (
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
        <h1>Kết quả gợi ý</h1>
        {/* Skeleton 3 the + dong chu luan phien (docs/07_UIUX.md muc 8) */}
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: t.bgSurface, borderRadius: 16, border: `1px solid ${t.border}`, padding: 16 }}>
              <Skeleton active avatar paragraph={{ rows: 3 }} />
            </div>
          ))}
        </div>
        <LoadingMessages messages={LOADING_MESSAGES} />
      </div>
    );
  }

  if (initialError) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="error"
          title="Không kết nối được máy chủ"
          subTitle="Kiểm tra mạng và thử lại."
          extra={
            <Button type="primary" onClick={loadInitial}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto' }}>
        <Result
          status="info"
          title="Chưa có kết quả"
          subTitle="Hãy trả lời wizard nhu cầu trước để xem gợi ý."
          extra={
            <Button type="primary" onClick={() => navigate('/wizard')}>
              Bắt đầu tư vấn
            </Button>
          }
        />
      </div>
    );
  }

  function toggleCompare(id: number) {
    const adding = !compareIds.includes(id);
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)));
    // Ghi lai su kien "them vao so sanh" (hanh vi ngam dinh, khong can nguoi dung bam Thich) -
    // day la 1 tin hieu tot de biet may nao dang duoc quan tam, dung cho UC-15/hoc them.
    if (adding && result) {
      api.post('/events', { sessionId: result.sessionId, laptopId: id, type: 'ADD_COMPARE' }).catch(() => undefined);
    }
  }

  /** FR-02: doi so luong ket qua hien thi (3-10 may) - goi lai CHINH request cu (luu tu
   * Wizard.tsx) voi `topN` moi, thay vi bat nguoi dung quay lai dien lai tu dau. */
  async function changeTopN(n: number) {
    setTopN(n);
    if (!requestBody) return; // khong co request goc (vd vao thang link cu) thi bo qua, giu nguyen ket qua
    setReloading(true);
    try {
      const r = await api.post<{ success: boolean; data: RecommendationResult }>('/recommendations', {
        ...requestBody,
        topN: n,
      });
      setResult(r.data.data);
    } catch {
      // giu nguyen ket qua cu neu goi lai loi - khong lam mat du lieu dang xem
    } finally {
      setReloading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Kết quả gợi ý</h1>
        {requestBody && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: t.textTertiary }}>Số lượng hiển thị</span>
            <Segmented
              options={TOPN_OPTIONS.map((n) => ({ label: String(n), value: n }))}
              value={topN}
              onChange={(v) => changeTopN(v as number)}
              disabled={reloading}
            />
            {reloading && <Spin size="small" />}
          </div>
        )}
      </div>

      {result.mode === 'FALLBACK' && <FallbackBanner />}
      {result.budgetRelaxed && <BudgetRelaxedBanner count={result.candidatesBeforeRelax} />}

      {result.items.length === 0 ? (
        /* Khong bao gio de trang trong tron: neu khong tim duoc may nao, phai noi RO vi sao
           va cho duong quay lai sua nhu cau ngay (docs/07 SS8). */
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Chưa tìm được máy nào khớp toàn bộ yêu cầu của bạn
              </div>
              <div style={{ color: t.textSecondary }}>
                Thường do ngân sách hơi thấp so với cấu hình mong muốn, hoặc ràng buộc bắt buộc
                (RAM / cân nặng) quá chặt.
              </div>
            </div>
          }
        >
          <Space wrap>
            <Button type="primary" onClick={() => navigate('/wizard')}>
              Sửa lại nhu cầu
            </Button>
            <Button onClick={() => navigate('/laptops')}>Tự xem danh mục</Button>
          </Space>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {result.items.map((item) => (
            <RecommendationCard
              key={item.laptopId}
              item={item}
              sessionId={result.sessionId}
              badges={badgesByLaptopId.get(item.laptopId)}
              onExplain={() => setExplainItem(item)}
              onCompareToggle={() => toggleCompare(item.laptopId)}
              isComparing={compareIds.includes(item.laptopId)}
            />
          ))}
        </div>
      )}

      {compareIds.length >= 2 && (
        <div style={{ position: 'sticky', bottom: 16, marginTop: 16, textAlign: 'center' }}>
          <Button type="primary" size="large" onClick={() => navigate(`/compare?ids=${compareIds.join(',')}`)}>
            So sánh {compareIds.length} máy đã chọn
          </Button>
        </div>
      )}

      <ExplainDrawer
        open={!!explainItem}
        onClose={() => setExplainItem(null)}
        item={explainItem}
        ideal={result.ideal}
        modelVersion={result.modelVersion}
        segment={result.segment}
      />
    </div>
  );
}
