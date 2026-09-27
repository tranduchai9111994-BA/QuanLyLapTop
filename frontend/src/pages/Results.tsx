import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Grid, Result, Segmented, Skeleton, Space, Spin } from 'antd';
import { RecommendationCard } from '../components/smart/RecommendationCard';
import { ExplainDrawer } from '../components/smart/ExplainDrawer';
import { RadarComparison } from '../components/smart/RadarComparison';
import { FallbackBanner, BudgetRelaxedBanner } from '../components/smart/FallbackBanner';
import { LoadingMessages } from '../components/smart/LoadingMessages';
import { api } from '../lib/api';
import { t } from '../theme/tokens';
import { toggleCompareId, useCompareIds } from '../lib/compareList';
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
  // docs/07_UIUX.md muc 6.3: >=992px (lg) hien luoi ket qua 2 cot + 1 panel radar dinh ben phai;
  // duoi 992px (kem md 768) hien 2 cot khong panel; duoi md la 1 cot (mac dinh cua CSS grid o
  // duoi khi khong ep gridTemplateColumns).
  const screens = Grid.useBreakpoint();
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
  // Panel radar dinh (lg/xl) doi theo may GAN NHAT nguoi dung bam "Vi sao goi y?" - CO CHU Y
  // tach rieng khoi `explainItem` (dieu khien Drawer): neu dung chung 1 state, panel se quay ve
  // may #1 NGAY khi dong Drawer (vi luc do explainItem=null), khien tinh nang "doi theo may dang
  // xem" gan nhu vo hinh trong thuc te (Drawer che mat panel trong khi no dang thuc su khac #1).
  const [panelFocusId, setPanelFocusId] = useState<number | null>(null);
  // Danh sach so sanh dung CHUNG toan app (localStorage, xem lib/compareList.ts) - chon o day
  // van con nguyen khi chuyen sang trang khac, TopNav hien duoc "So sanh (N)" (docs/07_UIUX.md
  // muc 6.1), khac voi truoc day chi la state cuc bo mat ngay khi roi trang Ket qua.
  const compareIds = useCompareIds();

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
    toggleCompareId(id);
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

  // docs/07_UIUX.md muc 6.3: tu >=992px (lg), them 1 panel radar DINH ben phai so sanh "ho so ly
  // tuong" voi may dang duoc chu y - mac dinh may hang #1 (goi y tot nhat), doi sang may nguoi
  // dung vua bam "Vi sao goi y?" de xem chi tiet hon o Drawer.
  const focusedItem = result.items.find((it) => it.laptopId === panelFocusId) ?? result.items[0] ?? null;
  const showRadarPanel = screens.lg && focusedItem;

  const itemsGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: screens.md ? 'repeat(2, 1fr)' : '1fr', gap: 12, alignItems: 'start' }}>
      {result.items.map((item) => (
        <RecommendationCard
          key={item.laptopId}
          item={item}
          sessionId={result.sessionId}
          badges={badgesByLaptopId.get(item.laptopId)}
          onExplain={() => {
            setExplainItem(item);
            setPanelFocusId(item.laptopId);
          }}
          onCompareToggle={() => toggleCompare(item.laptopId)}
          isComparing={compareIds.includes(item.laptopId)}
        />
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: showRadarPanel ? 1320 : 1200, margin: '24px auto', padding: '0 24px' }}>
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
      ) : showRadarPanel ? (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{itemsGrid}</div>
          <Card
            title={`Hồ sơ lý tưởng vs ${focusedItem.laptop.name}`}
            style={{ flex: '0 0 320px', position: 'sticky', top: 24 }}
            styles={{ body: { padding: 12 } }}
          >
            <RadarComparison ideal={result.ideal} laptop={focusedItem.laptop} height={220} />
            <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
              {panelFocusId != null
                ? 'Máy vừa xem "Vì sao gợi ý?" gần nhất'
                : 'Máy hạng #1 — bấm "Vì sao gợi ý?" ở máy khác để xem'}
            </div>
          </Card>
        </div>
      ) : (
        itemsGrid
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
