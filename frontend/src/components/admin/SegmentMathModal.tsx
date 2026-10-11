import { useState, type ReactNode } from 'react';
import { Alert, Button, Modal, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { segmentColors, t } from '../../theme/tokens';

/** Số liệu ML trả kèm mỗi dự đoán (ml-service/app/models/segment_explain.py) để giải thích bằng toán học. */
export interface SegmentExplain {
  model: { k: number; metric: string; weights: string; n_train: number };
  features: string[];
  scaling: { feature: string; kind: 'log2_z' | 'z' | 'keep'; mean: number | null; std: number | null }[];
  inputs: number[];
  query_z: number[];
  neighbors_z: number[][];
  neighbors_raw: number[][];
  /** Tên 7 láng giềng; null khi ML không dựng lại chắc chắn được (xem segment_explain.training_names). */
  neighbors_name?: string[] | null;
}

export interface SegmentNeighbor {
  label: string;
  distance: number;
}

/**
 * Kết quả của `POST /laptops/predict-segment` (backend `predictSegment` trong segment.service.ts,
 * dữ liệu lấy từ ML `/predict-segment`). Dùng chung cho màn AI gợi ý và màn Duyệt nhãn.
 */
export interface SegmentPrediction {
  /** Mã phân khúc có xác suất cao nhất: OFFICE | ULTRABOOK | GAMING | CREATOR. */
  label: string;
  /** Độ tin cậy = xác suất của `label`, từ 0 đến 1 (bằng số phiếu chia k). */
  proba: number;
  /** Xác suất của từng phân khúc, tổng bằng 1. */
  distribution: Record<string, number>;
  /** k máy gần nhất trong tập huấn luyện đã bỏ phiếu (FR-09): nhãn + khoảng cách. */
  neighbors: SegmentNeighbor[];
  /** Số liệu cho cửa sổ toán học: z-score, hiệu từng cột, số phiếu (có thể thiếu nếu ML cũ). */
  explain?: SegmentExplain;
  /** Ngưỡng tin cậy đang cấu hình ở backend (Cấu hình tri thức). */
  threshold?: number;
  /** Phiên bản mô hình đã tạo ra dự đoán này. */
  modelVersion?: string | null;
}

export type MathView = { type: 'neighbor'; index: number } | { type: 'vote' };

const FEATURE_LABEL: Record<string, string> = {
  ram_gb: 'RAM (GB)',
  ssd_gb: 'SSD (GB)',
  cpu_score: 'Điểm CPU',
  gpu_score: 'Điểm GPU',
  screen_inch: 'Màn hình (inch)',
  ppi: 'Mật độ điểm ảnh (ppi)',
  refresh_hz: 'Tần số quét (Hz)',
  weight_kg: 'Cân nặng (kg)',
  battery_wh: 'Pin (Wh)',
  gpu_dedicated: 'Card rời (0/1)',
  srgb_100: 'Màn chuẩn màu sRGB (0/1)',
};

const fmt = (v: number, digits = 4) => Number(v).toFixed(digits);
// Số mũ dạng chỉ số trên (5 -> ⁵) để viết "2⁵ = 32"
const superscript = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).replace('-', '⁻');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const segName = (code: string) => segmentColors[code]?.label ?? code;

/** Trọng số phiếu của từng láng giềng: uniform = 1 phiếu; distance = 1/khoảng cách (sklearn: gặp khoảng cách 0 thì chỉ máy đó tính). */
function voteWeights(distances: number[], weights: string): number[] {
  if (weights !== 'distance') return distances.map(() => 1);
  const zeros = distances.map((d) => d === 0);
  if (zeros.some(Boolean)) return zeros.map((z) => (z ? 1 : 0));
  return distances.map((d) => 1 / d);
}

interface Props {
  view: MathView | null;
  onClose: () => void;
  explain: SegmentExplain;
  neighbors: SegmentNeighbor[];
  distribution: Record<string, number>;
  proba: number;
  /** Ngưỡng tin cậy đang cấu hình (backend trả kèm dự đoán). */
  threshold: number;
  /** Chuyển sang cửa sổ khác (bấm vào một láng giềng, nút Trước/Sau, về bảng tổng hợp). */
  onNavigate: (view: MathView) => void;
  /** Nội dung hiện ở đầu cửa sổ (vd tên máy, ghi chú so sánh với nhãn đang lưu). */
  notice?: ReactNode;
}

/** Cửa sổ "Vì sao ra kết quả này?" mở từ icon "!" của SegmentSuggester: bảng toán học từng bước để giải thích với hội đồng. */
export function SegmentMathModal({ view, onClose, onNavigate, explain, neighbors, distribution, proba, threshold, notice }: Props) {
  const manhattan = explain.model.metric === 'manhattan';
  const names = explain.neighbors_name ?? null;
  const idx = view?.type === 'neighbor' ? view.index : -1;
  const title =
    view?.type === 'neighbor'
      ? `Vì sao máy #${idx + 1}${names ? ` (${names[idx]})` : ''} cách ${fmt(neighbors[idx]?.distance ?? 0, 2)}${
          (neighbors[idx]?.distance ?? 1) < 1e-6 ? ' (chính máy đang nhập)' : ''
        }?`
      : `Vì sao độ tin cậy là ${pct(proba)}?`;

  // Cửa sổ láng giềng có nút Trước/Sau để lần lượt xem #1…#7 mà không phải đóng mở
  const footer =
    view?.type === 'neighbor' ? (
      <Space>
        <Button disabled={idx <= 0} onClick={() => onNavigate({ type: 'neighbor', index: idx - 1 })}>
          ← Máy trước
        </Button>
        <Button disabled={idx >= neighbors.length - 1} onClick={() => onNavigate({ type: 'neighbor', index: idx + 1 })}>
          Máy sau →
        </Button>
        <Button type="primary" onClick={() => onNavigate({ type: 'vote' })}>
          Về bảng tổng hợp
        </Button>
      </Space>
    ) : null;

  return (
    <Modal
      open={view !== null}
      onCancel={onClose}
      footer={footer}
      width="min(1500px, 96vw)" // gần toàn màn hình để các bảng 6-8 cột không bị cắt hay phải cuộn ngang
      centered
      title={title}
      destroyOnHidden
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }} // thân cuộn riêng, tiêu đề và nút luôn hiện
    >
      {notice}
      {view?.type === 'neighbor' && neighbors[idx] && (
        <NeighborMath explain={explain} index={idx} neighbor={neighbors[idx]} manhattan={manhattan} />
      )}
      {view?.type === 'vote' && (
        <VoteMath explain={explain} neighbors={neighbors} distribution={distribution} proba={proba} threshold={threshold} onNavigate={onNavigate} />
      )}
    </Modal>
  );
}

function NeighborMath({
  explain,
  index,
  neighbor,
  manhattan,
}: {
  explain: SegmentExplain;
  index: number;
  neighbor: SegmentNeighbor;
  manhattan: boolean;
}) {
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          manhattan
            ? 'Khoảng cách Manhattan = cộng |hiệu| của cả 11 cột (đã chuẩn hóa).'
            : 'Khoảng cách Euclidean (Pytago nhiều chiều) = √(cộng hiệu² của cả 11 cột đã chuẩn hóa).'
        }
        description={`Máy láng giềng #${index + 1}${explain.neighbors_name ? ` (${explain.neighbors_name[index]})` : ''} là một trong ${explain.model.n_train} máy mô hình đã ghi nhớ khi huấn luyện, nhãn ${segName(neighbor.label)}.`}
      />

      <Typography.Title level={5}>Bước 1. Đổi 11 thông số của máy đang nhập sang z-score</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Để các cột cùng một thước đo (GB, kg, Hz không so trực tiếp được), mỗi cột đổi thành z = (giá trị − TB) ÷ ĐLC. RAM và SSD lấy log₂ trước. Trung bình và độ lệch chuẩn được
        tính từ {explain.model.n_train} máy huấn luyện, lưu trong mô hình.
      </Typography.Paragraph>
      <ZScoreTable explain={explain} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 2. So với máy #{index + 1}: hiệu từng cột rồi cộng lại
      </Typography.Title>
      <DistanceBreakdown explain={explain} index={index} neighbor={neighbor} />
    </div>
  );
}


/**
 * Bảng "hiệu từng cột rồi cộng lại" giữa máy đang nhập và láng giềng thứ `index`, kèm kết luận khoảng cách.
 * Dùng ở cửa sổ của từng láng giềng (đầy đủ) và làm bảng ví dụ ở Bước 2 của cửa sổ tổng hợp (`compact`).
 */
function DistanceBreakdown({
  explain,
  index,
  neighbor,
  compact = false,
}: {
  explain: SegmentExplain;
  index: number;
  neighbor: SegmentNeighbor;
  compact?: boolean;
}) {
  const manhattan = explain.model.metric === 'manhattan';
  const { features, inputs, query_z: qz, neighbors_z, neighbors_raw } = explain;
  const nz = neighbors_z[index];
  const nraw = neighbors_raw[index];

  // Hiệu từng cột giữa máy đang nhập và máy láng giềng
  const diffs = features.map((_, j) => qz[j] - nz[j]);
  const terms = diffs.map((d) => (manhattan ? Math.abs(d) : d * d));
  const total = terms.reduce((a, b) => a + b, 0);
  const result = manhattan ? total : Math.sqrt(total);
  // Tổng bằng 0: láng giềng này chính là máy đang nhập (máy đã nằm trong dữ liệu huấn luyện), nên mọi hiệu đều bằng 0
  const isSelf = total < 1e-9;
  const step2 = features.map((f, j) => ({
    key: f,
    label: FEATURE_LABEL[f] ?? f,
    myRaw: inputs[j],
    nRaw: nraw[j],
    myZ: qz[j],
    nZ: nz[j],
    diff: diffs[j],
    term: terms[j],
    share: total > 0 ? (terms[j] / total) * 100 : 0,
  }));
  const termTitle = manhattan ? '|Hiệu|' : 'Hiệu²';
  const step2Columns: ColumnsType<(typeof step2)[number]> = [
    { title: 'Đặc trưng', dataIndex: 'label' },
    // Bản đầy đủ có thêm hai cột giá trị gốc để đối chiếu; bản gọn (compact) bỏ đi cho vừa cửa sổ tổng hợp
    ...(compact
      ? []
      : [
          { title: 'Máy nhập (gốc)', dataIndex: 'myRaw', align: 'right' as const, render: (v: number) => fmt(v, 2) },
          { title: `Máy #${index + 1} (gốc)`, dataIndex: 'nRaw', align: 'right' as const, render: (v: number) => fmt(v, 2) },
        ]),
    { title: 'z máy nhập', dataIndex: 'myZ', align: 'right', render: (v: number) => fmt(v) },
    { title: `z máy #${index + 1}`, dataIndex: 'nZ', align: 'right', render: (v: number) => fmt(v) },
    { title: 'Hiệu = z nhập − z láng giềng', dataIndex: 'diff', align: 'right', render: (v: number) => fmt(v) },
    { title: termTitle, dataIndex: 'term', align: 'right', render: (v: number) => fmt(v) },
    { title: '% của tổng', dataIndex: 'share', align: 'right', render: (v: number) => (isSelf ? '—' : `${fmt(v, 1)}%`) },
  ];

  return (
    <>
      {isSelf && (
        <Alert
          style={{ marginBottom: 8 }}
          type="info"
          showIcon
          message={`Máy #${index + 1} chính là máy đang nhập: nó đã nằm trong ${explain.model.n_train} máy huấn luyện nên 11 thông số giống hệt nhau. Mọi hiệu bằng 0 và khoảng cách bằng 0 là đúng, không phải lỗi tính toán.`}
        />
      )}
      <Table
        size="small"
        pagination={false}
        dataSource={step2}
        columns={step2Columns}
        scroll={{ x: 'max-content' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: t.bgSubtle }}>
              <Table.Summary.Cell index={0} colSpan={compact ? 4 : 6}>
                <strong>Tổng {manhattan ? '|hiệu|' : 'hiệu²'}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong>{fmt(total)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                {isSelf ? '—' : '100%'}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <Alert
        style={{ marginTop: 12 }}
        type="success"
        showIcon
        message={
          manhattan ? (
            <span>
              Khoảng cách = tổng = <strong>{fmt(result)}</strong>
            </span>
          ) : (
            <span>
              Khoảng cách = √{fmt(total)} = <strong>{fmt(result)}</strong>
            </span>
          )
        }
        description={compact ? undefined : `Hệ thống tính ra ${fmt(neighbor.distance)}, giao diện làm tròn ${fmt(neighbor.distance, 2)}. Chênh nhỏ (nếu có) do các z ở bảng đã làm tròn 4 chữ số.`}
      />
    </>
  );
}

/** Bảng "đổi 11 thông số của máy đang nhập sang z-score" (dùng chung cho cửa sổ láng giềng và cửa sổ độ tin cậy). */
function ZScoreTable({ explain }: { explain: SegmentExplain }) {
  const { features, scaling, inputs, query_z: qz } = explain;
  const step1 = features.map((f, j) => {
    const s = scaling[j];
    const afterLog = s.kind === 'log2_z' ? Math.log2(inputs[j]) : inputs[j];
    return { key: f, label: FEATURE_LABEL[f] ?? f, raw: inputs[j], afterLog, s, z: qz[j] };
  });
  const step1Columns: ColumnsType<(typeof step1)[number]> = [
    { title: 'Đặc trưng', dataIndex: 'label' },
    { title: 'Giá trị nhập', dataIndex: 'raw', align: 'right', render: (v: number) => fmt(v, 2) },
    {
      // RAM/SSD: log₂ của giá trị nhập; nếu là số nguyên thì ghi thêm "vì 2ⁿ = giá trị" cho dễ kiểm tra
      title: 'Sau log₂',
      align: 'right',
      render: (_, r) =>
        r.s.kind !== 'log2_z'
          ? '—'
          : Number.isInteger(r.afterLog)
            ? `${fmt(r.afterLog, 4)} (vì 2${superscript(r.afterLog)} = ${fmt(r.raw, 0)})`
            : `${fmt(r.afterLog, 4)} (log₂ của ${fmt(r.raw, 0)})`,
    },
    {
      title: 'Trung bình (TB)',
      align: 'right',
      render: (_, r) => (r.s.mean === null ? '—' : fmt(r.s.mean, 4)),
    },
    {
      title: 'Độ lệch chuẩn (ĐLC)',
      align: 'right',
      render: (_, r) => (r.s.std === null ? '—' : fmt(r.s.std, 4)),
    },
    {
      // Thay số vào công thức z = (x − TB) ÷ ĐLC, ghi cả bước trung gian (tử số) để tự tính lại bằng máy tính
      title: 'Công thức',
      align: 'right',
      render: (_, r) =>
        r.s.mean === null || r.s.std === null
          ? 'giữ nguyên'
          : `(${fmt(r.afterLog, 4)} − ${fmt(r.s.mean, 4)}) ÷ ${fmt(r.s.std, 4)} = ${fmt(r.afterLog - r.s.mean, 4)} ÷ ${fmt(r.s.std, 4)}`,
    },
    { title: 'z', align: 'right', render: (_, r) => <strong>{r.s.kind === 'keep' ? fmt(r.z, 0) : fmt(r.z, 4)}</strong> },
  ];

  return <Table size="small" pagination={false} dataSource={step1} columns={step1Columns} scroll={{ x: 'max-content' }} />;
}

/** Cộng các số hạng của khoảng cách (hiệu² hoặc |hiệu|) giữa máy đang nhập và láng giềng thứ i. */
function distanceTotal(explain: SegmentExplain, index: number): number {
  const manhattan = explain.model.metric === 'manhattan';
  return explain.query_z.reduce((sum, q, j) => {
    const d = q - explain.neighbors_z[index][j];
    return sum + (manhattan ? Math.abs(d) : d * d);
  }, 0);
}

function VoteMath({
  explain,
  neighbors,
  distribution,
  proba,
  threshold,
  onNavigate,
}: {
  explain: SegmentExplain;
  neighbors: SegmentNeighbor[];
  distribution: Record<string, number>;
  proba: number;
  threshold: number;
  onNavigate: (view: MathView) => void;
}) {
  const { k, weights } = explain.model;
  const names = explain.neighbors_name ?? null;
  const [example, setExample] = useState(0); // máy láng giềng đang xem làm ví dụ ở Bước 2a (chỉ số 0 = #1)
  // Cột "Láng giềng": bấm vào để xem bảng tính khoảng cách của máy đó
  const rankCell = (rank: number) => (
    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onNavigate({ type: 'neighbor', index: rank - 1 })}>
      #{rank}
    </Button>
  );
  const nameColumn = names ? [{ title: 'Máy', key: 'name', render: (_: unknown, r: { rank: number }) => names[r.rank - 1] }] : [];
  const w = voteWeights(
    neighbors.map((n) => n.distance),
    weights
  );
  const totalWeight = w.reduce((a, b) => a + b, 0);

  const voteRows = neighbors.map((n, i) => ({ key: i, rank: i + 1, label: n.label, distance: n.distance, weight: w[i] }));

  const manhattan = explain.model.metric === 'manhattan';
  const distRows = neighbors.map((n, i) => {
    const total = distanceTotal(explain, i);
    return { key: i, rank: i + 1, label: n.label, total, result: manhattan ? total : Math.sqrt(total), system: n.distance };
  });
  const distColumns: ColumnsType<(typeof distRows)[number]> = [
    { title: 'Láng giềng (bấm để xem tính)', dataIndex: 'rank', render: (v: number) => rankCell(v) },
    ...nameColumn,
    { title: 'Nhãn', dataIndex: 'label', render: (v: string) => <Tag color={segmentColors[v]?.color}>{segName(v)}</Tag> },
    { title: manhattan ? 'Tổng |hiệu| của 11 cột' : 'Tổng hiệu² của 11 cột', dataIndex: 'total', align: 'right', render: (v: number) => fmt(v) },
    {
      title: manhattan ? 'Khoảng cách = tổng' : 'Khoảng cách = √ tổng',
      dataIndex: 'result',
      align: 'right',
      render: (v: number) => <strong>{fmt(v)}</strong>,
    },
    { title: 'Hệ thống trả về', dataIndex: 'system', align: 'right', render: (v: number) => fmt(v) },
  ];
  // Láng giềng cách 0 nghĩa là máy đang nhập chính là một máy đã nằm trong dữ liệu huấn luyện: nó tự bỏ một phiếu cho chính mình.
  const selfVote = neighbors.length > 0 && neighbors[0].distance < 1e-6;

  const labels = Object.keys(distribution);
  const labelRows = labels
    .map((label) => {
      const members = voteRows.filter((r) => r.label === label);
      const sum = members.reduce((a, r) => a + r.weight, 0);
      return {
        key: label,
        label,
        ranks: members.map((r) => r.rank), // thứ hạng các láng giềng đã bỏ phiếu cho phân khúc này
        count: members.length,
        sum,
        computed: totalWeight > 0 ? sum / totalWeight : 0,
        system: distribution[label],
      };
    })
    .sort((a, b) => b.system - a.system);

  const top = labelRows[0];
  const tie = labelRows.length > 1 && Math.abs(labelRows[0].system - labelRows[1].system) < 1e-9 && labelRows[0].system > 0;
  const needVotes = Math.ceil(threshold * k - 1e-9);
  const uniform = weights !== 'distance';

  const voteColumns: ColumnsType<(typeof voteRows)[number]> = [
    { title: 'Láng giềng', dataIndex: 'rank', render: (v: number) => rankCell(v) },
    ...nameColumn,
    {
      title: 'Nhãn',
      dataIndex: 'label',
      render: (v: string) => <Tag color={segmentColors[v]?.color}>{segName(v)}</Tag>,
    },
    { title: 'Khoảng cách', dataIndex: 'distance', align: 'right', render: (v: number) => fmt(v) },
    {
      title: uniform ? 'Số phiếu' : 'Trọng số phiếu = 1 ÷ khoảng cách',
      dataIndex: 'weight',
      align: 'right',
      render: (v: number) => (uniform ? '1' : fmt(v)),
    },
  ];
  const labelColumns: ColumnsType<(typeof labelRows)[number]> = [
    { title: 'Phân khúc', dataIndex: 'label', render: (v: string) => <Tag color={segmentColors[v]?.color}>{segName(v)}</Tag> },
    {
      // Những láng giềng nào đã bỏ phiếu cho phân khúc này (bấm #i để xem cách tính khoảng cách của máy đó)
      title: 'Láng giềng',
      key: 'ranks',
      render: (_, r) =>
        r.ranks.length === 0
          ? '—'
          : r.ranks.map((rank, n) => (
              <span key={rank}>
                {n > 0 && ', '}
                {rankCell(rank)}
              </span>
            )),
    },
    {
      title: uniform ? 'Số phiếu' : 'Tổng trọng số phiếu',
      key: 'votes',
      align: 'right',
      render: (_, r) => (uniform ? r.count : fmt(r.sum)),
    },
    {
      title: uniform ? 'Phép tính = số phiếu ÷ k' : 'Phép tính = tổng trọng số ÷ tổng tất cả',
      key: 'calc',
      align: 'right',
      render: (_, r) => (uniform ? `${r.count} ÷ ${k}` : `${fmt(r.sum)} ÷ ${fmt(totalWeight)}`),
    },
    { title: 'Xác suất', dataIndex: 'computed', align: 'right', render: (v: number) => fmt(v) },
    { title: 'Giao diện', dataIndex: 'system', align: 'right', render: (v: number) => <strong>{pct(v)}</strong> },
  ];
  // Dòng tổng: số phiếu cộng lại phải bằng k và xác suất cộng lại bằng 1
  const totalVotes = uniform ? labelRows.reduce((a, r) => a + r.count, 0) : totalWeight;
  const totalProba = labelRows.reduce((a, r) => a + r.computed, 0);

  const passes = proba >= threshold;
  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          uniform
            ? `Mô hình lấy ${k} máy giống nhất, mỗi máy 1 phiếu; xác suất của một phân khúc = số phiếu ÷ ${k}.`
            : `Mô hình lấy ${k} máy giống nhất; máy càng gần thì phiếu càng nặng (1 ÷ khoảng cách).`
        }
      />

      <Typography.Title level={5}>Bước 1. Chuẩn hóa 11 thông số của máy đang nhập (z-score)</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Để các cột cùng một thước đo (GB, kg, Hz không so trực tiếp được), mỗi cột đổi thành z = (giá trị − TB) ÷ ĐLC. RAM và SSD lấy log₂ trước. Trung bình và độ lệch chuẩn được tính từ{' '}
        {explain.model.n_train} máy huấn luyện, lưu trong mô hình.
      </Typography.Paragraph>
      <ZScoreTable explain={explain} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 2. Đo khoảng cách tới {explain.model.n_train} máy đã ghi nhớ, giữ {k} máy gần nhất
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Với mỗi máy trong {explain.model.n_train} máy: lấy hiệu từng cột (đã chuẩn hóa),{' '}
        {manhattan ? 'cộng |hiệu|' : 'bình phương rồi cộng, lấy căn bậc hai'}. Bước 2a minh họa cách tính cho MỘT máy (chọn #1 đến #{k} để xem);
        Bước 2b là kết quả của {k} máy gần nhất sau khi làm tương tự cho cả {explain.model.n_train} máy.
      </Typography.Paragraph>

      <Typography.Text strong>2a. Ví dụ cách tính khoảng cách tới một máy</Typography.Text>
      <div style={{ margin: '8px 0' }}>
        <Space wrap>
          <Segmented
            value={example}
            onChange={(v) => setExample(Number(v))}
            options={neighbors.map((_, i) => ({ label: `#${i + 1}`, value: i }))}
          />
          <span>
            Máy #{example + 1}
            {names ? `: ${names[example]}` : ''} (nhãn {segName(neighbors[example].label)}); cột "z máy nhập" lấy từ bảng Bước 1
          </span>
        </Space>
      </div>
      <DistanceBreakdown explain={explain} index={example} neighbor={neighbors[example]} compact />

      <Typography.Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
        2b. Kết quả của {k} máy gần nhất (bấm #i để xem bảng đầy đủ của máy đó)
      </Typography.Text>
      <Table size="small" pagination={false} dataSource={distRows} columns={distColumns} />
      {selfVote && (
        <Alert
          style={{ marginTop: 8 }}
          type="info"
          showIcon
          message="Láng giềng #1 cách 0.0000: máy này đã nằm trong dữ liệu huấn luyện, nên nó tự bỏ một phiếu cho chính mình (kết quả dễ hơn so với máy mới hoàn toàn)."
        />
      )}

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 3. Mỗi láng giềng bỏ phiếu
      </Typography.Title>
      <Table size="small" pagination={false} dataSource={voteRows} columns={voteColumns} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 4. Đếm phiếu ra xác suất
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        dataSource={labelRows}
        columns={labelColumns}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row style={{ background: t.bgSubtle }}>
              <Table.Summary.Cell index={0} colSpan={2}>
                <strong>Tổng</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong>{uniform ? totalVotes : fmt(totalVotes)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} align="right">
                <strong>{fmt(totalProba)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 5. So với ngưỡng tin cậy
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        showHeader={false}
        dataSource={[
          { key: 1, k: 'Độ tin cậy = xác suất cao nhất', v: `${segName(top.label)}: ${pct(proba)}` },
          { key: 2, k: 'Ngưỡng tự duyệt đang cấu hình (đổi ở Cấu hình tri thức)', v: pct(threshold) },
          {
            key: 3,
            k: `Số phiếu tối thiểu để qua ngưỡng (k = ${k})`,
            v: uniform ? `${needVotes} ÷ ${k} = ${fmt(needVotes / k, 3)} ≥ ${fmt(threshold, 2)}` : '—',
          },
        ]}
        columns={[{ dataIndex: 'k' }, { dataIndex: 'v', align: 'right' }]}
      />
      <Alert
        style={{ marginTop: 12 }}
        type={passes ? 'success' : 'warning'}
        showIcon
        message={
          passes
            ? `${pct(proba)} ≥ ${pct(threshold)}: đủ tin cậy, khi lưu máy được duyệt tự động.`
            : `${pct(proba)} < ${pct(threshold)}: chưa đủ tin cậy, khi lưu mà để trống phân khúc thì máy vào hàng đợi "Cần xác minh".`
        }
        description={
          tie
            ? 'Hai phân khúc đang hòa phiếu nên nhãn hiển thị đầu tiên chỉ do thứ tự sắp xếp, không có nghĩa AI nghiêng về nhãn đó; điều quan trọng là độ tin cậy.'
            : undefined
        }
      />
    </div>
  );
}
