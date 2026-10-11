import { Alert, Modal, Table, Tag, Typography } from 'antd';
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
}

export interface SegmentNeighbor {
  label: string;
  distance: number;
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

// Ngưỡng mặc định của backend (segment.service.ts); quản trị có thể đổi ở "Cấu hình tri thức".
const DEFAULT_THRESHOLD = 0.6;

const fmt = (v: number, digits = 4) => Number(v).toFixed(digits);
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
}

/** Cửa sổ "Vì sao ra kết quả này?" mở từ icon "!" của SegmentSuggester: bảng toán học từng bước để giải thích với hội đồng. */
export function SegmentMathModal({ view, onClose, explain, neighbors, distribution, proba }: Props) {
  const manhattan = explain.model.metric === 'manhattan';
  const title =
    view?.type === 'neighbor'
      ? `Vì sao máy #${view.index + 1} cách ${fmt(neighbors[view.index]?.distance ?? 0, 2)}?`
      : `Vì sao độ tin cậy là ${pct(proba)}?`;

  return (
    <Modal open={view !== null} onCancel={onClose} footer={null} width={940} title={title} destroyOnClose>
      {view?.type === 'neighbor' && neighbors[view.index] && (
        <NeighborMath explain={explain} index={view.index} neighbor={neighbors[view.index]} manhattan={manhattan} />
      )}
      {view?.type === 'vote' && <VoteMath explain={explain} neighbors={neighbors} distribution={distribution} proba={proba} />}
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
  const { features, scaling, inputs, query_z: qz, neighbors_z, neighbors_raw } = explain;
  const nz = neighbors_z[index];
  const nraw = neighbors_raw[index];

  // Bước 1: z-score của máy đang nhập
  const step1 = features.map((f, j) => {
    const s = scaling[j];
    const afterLog = s.kind === 'log2_z' ? Math.log2(inputs[j]) : inputs[j];
    return { key: f, label: FEATURE_LABEL[f] ?? f, raw: inputs[j], afterLog, s, z: qz[j] };
  });
  const step1Columns: ColumnsType<(typeof step1)[number]> = [
    { title: 'Đặc trưng', dataIndex: 'label' },
    { title: 'Giá trị nhập', dataIndex: 'raw', align: 'right', render: (v: number) => fmt(v, 2) },
    {
      title: 'Sau log₂',
      align: 'right',
      render: (_, r) => (r.s.kind === 'log2_z' ? fmt(r.afterLog, 4) : '—'),
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
      title: 'z = (x − TB) ÷ ĐLC',
      align: 'right',
      render: (_, r) =>
        r.s.mean === null || r.s.std === null ? (
          <span>giữ nguyên {fmt(r.z, 0)}</span>
        ) : (
          <span>
            ({fmt(r.afterLog, 4)} − {fmt(r.s.mean, 4)}) ÷ {fmt(r.s.std, 4)} = <strong>{fmt(r.z, 4)}</strong>
          </span>
        ),
    },
  ];

  // Bước 2: hiệu từng cột giữa máy đang nhập và máy láng giềng
  const diffs = features.map((_, j) => qz[j] - nz[j]);
  const terms = diffs.map((d) => (manhattan ? Math.abs(d) : d * d));
  const total = terms.reduce((a, b) => a + b, 0);
  const result = manhattan ? total : Math.sqrt(total);
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
    { title: 'Máy nhập (gốc)', dataIndex: 'myRaw', align: 'right', render: (v: number) => fmt(v, 2) },
    { title: `Máy #${index + 1} (gốc)`, dataIndex: 'nRaw', align: 'right', render: (v: number) => fmt(v, 2) },
    { title: 'z máy nhập', dataIndex: 'myZ', align: 'right', render: (v: number) => fmt(v) },
    { title: `z máy #${index + 1}`, dataIndex: 'nZ', align: 'right', render: (v: number) => fmt(v) },
    { title: 'Hiệu = z nhập − z láng giềng', dataIndex: 'diff', align: 'right', render: (v: number) => fmt(v) },
    { title: termTitle, dataIndex: 'term', align: 'right', render: (v: number) => fmt(v) },
    { title: '% của tổng', dataIndex: 'share', align: 'right', render: (v: number) => `${fmt(v, 1)}%` },
  ];

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
        description={`Máy láng giềng #${index + 1} là một trong ${explain.model.n_train} máy mô hình đã ghi nhớ khi huấn luyện, nhãn ${segName(neighbor.label)}.`}
      />

      <Typography.Title level={5}>Bước 1. Đổi 11 thông số của máy đang nhập sang z-score</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Để các cột cùng một thước đo (GB, kg, Hz không so trực tiếp được). RAM và SSD lấy log₂ trước. Trung bình và độ lệch chuẩn được
        tính từ {explain.model.n_train} máy huấn luyện, lưu trong mô hình.
      </Typography.Paragraph>
      <Table size="small" pagination={false} dataSource={step1} columns={step1Columns} scroll={{ x: 'max-content' }} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 2. So với máy #{index + 1}: hiệu từng cột rồi cộng lại
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        dataSource={step2}
        columns={step2Columns}
        scroll={{ x: 'max-content' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: t.bgSubtle }}>
              <Table.Summary.Cell index={0} colSpan={6}>
                <strong>Tổng {manhattan ? '|hiệu|' : 'hiệu²'}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong>{fmt(total)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                100%
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
        description={`Hệ thống tính ra ${fmt(neighbor.distance)}, giao diện làm tròn ${fmt(neighbor.distance, 2)}. Chênh nhỏ (nếu có) do các z ở bảng đã làm tròn 4 chữ số.`}
      />
    </div>
  );
}

function VoteMath({
  explain,
  neighbors,
  distribution,
  proba,
}: {
  explain: SegmentExplain;
  neighbors: SegmentNeighbor[];
  distribution: Record<string, number>;
  proba: number;
}) {
  const { k, weights } = explain.model;
  const w = voteWeights(
    neighbors.map((n) => n.distance),
    weights
  );
  const totalWeight = w.reduce((a, b) => a + b, 0);

  const voteRows = neighbors.map((n, i) => ({ key: i, rank: i + 1, label: n.label, distance: n.distance, weight: w[i] }));

  const labels = Object.keys(distribution);
  const labelRows = labels
    .map((label) => {
      const members = voteRows.filter((r) => r.label === label);
      const sum = members.reduce((a, r) => a + r.weight, 0);
      return { key: label, label, count: members.length, sum, computed: totalWeight > 0 ? sum / totalWeight : 0, system: distribution[label] };
    })
    .sort((a, b) => b.system - a.system);

  const top = labelRows[0];
  const tie = labelRows.length > 1 && Math.abs(labelRows[0].system - labelRows[1].system) < 1e-9 && labelRows[0].system > 0;
  const needVotes = Math.ceil(DEFAULT_THRESHOLD * k - 1e-9);
  const uniform = weights !== 'distance';

  const voteColumns: ColumnsType<(typeof voteRows)[number]> = [
    { title: 'Láng giềng', dataIndex: 'rank', render: (v: number) => `#${v}` },
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
    { title: 'Số láng giềng', dataIndex: 'count', align: 'right' },
    {
      title: uniform ? 'Phép tính = số phiếu ÷ k' : 'Phép tính = tổng trọng số ÷ tổng tất cả',
      align: 'right',
      render: (_, r) => (uniform ? `${r.count} ÷ ${k} = ${fmt(r.computed)}` : `${fmt(r.sum)} ÷ ${fmt(totalWeight)} = ${fmt(r.computed)}`),
    },
    { title: 'Xác suất', dataIndex: 'system', align: 'right', render: (v: number) => <strong>{pct(v)}</strong> },
  ];

  const passes = proba >= DEFAULT_THRESHOLD;
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

      <Typography.Title level={5}>Bước 1. {k} láng giềng và phiếu của từng máy</Typography.Title>
      <Table size="small" pagination={false} dataSource={voteRows} columns={voteColumns} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 2. Đếm phiếu ra xác suất
      </Typography.Title>
      <Table size="small" pagination={false} dataSource={labelRows} columns={labelColumns} />

      <Typography.Title level={5} style={{ marginTop: 20 }}>
        Bước 3. So với ngưỡng tin cậy
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        showHeader={false}
        dataSource={[
          { key: 1, k: 'Độ tin cậy = xác suất cao nhất', v: `${segName(top.label)}: ${pct(proba)}` },
          { key: 2, k: 'Ngưỡng tự duyệt (mặc định, đổi ở Cấu hình tri thức)', v: pct(DEFAULT_THRESHOLD) },
          {
            key: 3,
            k: `Số phiếu tối thiểu để qua ngưỡng (k = ${k})`,
            v: uniform ? `${needVotes} ÷ ${k} = ${fmt(needVotes / k, 3)} ≥ ${fmt(DEFAULT_THRESHOLD, 2)}` : '—',
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
            ? `${pct(proba)} ≥ ${pct(DEFAULT_THRESHOLD)}: đủ tin cậy, khi lưu máy được duyệt tự động.`
            : `${pct(proba)} < ${pct(DEFAULT_THRESHOLD)}: chưa đủ tin cậy, khi lưu mà để trống phân khúc thì máy vào hàng đợi "Cần xác minh".`
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
