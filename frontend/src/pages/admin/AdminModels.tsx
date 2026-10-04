import { useEffect, useState } from 'react';
import { Alert, Button, Card, Drawer, Input, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, HistoryOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';

interface TestMetrics {
  f1_macro: number;
  report: Record<string, { precision: number; recall: number; 'f1-score': number; support: number }>;
  confusion_matrix: number[][];
  labels: string[];
}
interface Metrics {
  cv: { f1_macro_mean: number; f1_macro_std: number };
  test: TestMetrics;
  baseline: { dummy_f1_macro: number; rule_f1_macro: number };
  k_curve: { k: number; f1_macro_mean: number; f1_macro_std: number }[];
}
interface ModelVersionRow {
  id: number;
  version: string;
  type: string;
  status: 'CHAMPION' | 'CHALLENGER' | 'ARCHIVED';
  paramsJson: string;
  metricsJson: string;
  datasetHash: string;
  nSamples: number;
  trainedAt: string;
  promotedAt: string | null;
  note: string | null;
}

const STATUS_COLOR: Record<string, string> = { CHAMPION: 'green', CHALLENGER: 'blue', ARCHIVED: 'default' };
const STATUS_LABEL: Record<string, string> = { CHAMPION: 'Đang dùng (Champion)', CHALLENGER: 'Ứng viên', ARCHIVED: 'Đã lưu trữ' };

/** FR-12 Quản lý mô hình: xem lịch sử các lần huấn luyện Mô hình A (kNN phân lớp phân khúc),
 * so sánh macro-F1 với baseline, xem confusion matrix + đường cong chọn k, và điều khiển vòng
 * đời "champion/challenger" (docs/09_VONG_DOI_TRI_TUE.md) — huấn luyện KHÔNG tự thay thế mô hình
 * đang chạy, phải qua bước "Đưa vào sử dụng" (promote, backend tự kiểm quy tắc an toàn) hoặc
 * "Quay lại phiên bản này" (rollback) cho một phiên bản CŨ đã từng là champion. */
export function AdminModels() {
  const [rows, setRows] = useState<ModelVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [note, setNote] = useState('');
  const [busyVersion, setBusyVersion] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelVersionRow | null>(null);

  function load() {
    setLoading(true);
    api
      .get('/models')
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được danh sách mô hình.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function train() {
    setTraining(true);
    try {
      // Huấn luyện mất ~30 giây (mặc định api chỉ chờ 10 giây nên báo thất bại giả); backend chờ tối đa 60 giây
      await api.post('/models/train', { note: note || undefined }, { timeout: 70_000 });
      message.success('Huấn luyện xong — phiên bản mới ở trạng thái "Ứng viên", chưa tự động dùng cho khách.');
      setNote('');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Huấn luyện thất bại.');
    } finally {
      setTraining(false);
    }
  }

  async function promote(version: string) {
    setBusyVersion(version);
    try {
      await api.post(`/models/${version}/promote`);
      message.success(`Đã đưa phiên bản ${version} vào sử dụng cho khách hàng.`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Từ chối đưa vào sử dụng — xem quy tắc an toàn.');
    } finally {
      setBusyVersion(null);
    }
  }

  async function rollback(version: string) {
    setBusyVersion(version);
    try {
      await api.post(`/models/${version}/rollback`);
      message.success(`Đã quay lại dùng phiên bản ${version}.`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Quay lại thất bại.');
    } finally {
      setBusyVersion(null);
    }
  }

  const metrics: Metrics | null = detail ? JSON.parse(detail.metricsJson) : null;
  const params: Record<string, unknown> | null = detail ? JSON.parse(detail.paramsJson) : null;

  return (
    <div>
      <h2>Quản lý mô hình (Mô hình A — phân loại phân khúc)</h2>
      <p style={{ color: t.textSecondary }}>
        Mỗi lần huấn luyện tạo ra một "ứng viên" mới — không tự động thay mô hình đang phục vụ
        khách hàng. Chỉ khi bấm "Đưa vào sử dụng" hệ thống mới kiểm tra đủ an toàn (không tệ hơn
        bản đang dùng quá 2% macro-F1, mọi lớp đạt tối thiểu 0,5) rồi mới chuyển đổi.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder="Ghi chú cho lần huấn luyện này (không bắt buộc)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ maxWidth: 400 }}
          />
          <Button type="primary" icon={<ThunderboltOutlined />} loading={training} onClick={train}>
            Huấn luyện mô hình mới
          </Button>
        </div>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Phiên bản', dataIndex: 'version' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>,
          },
          {
            title: 'macro-F1 (test)',
            render: (_: unknown, r: ModelVersionRow) => {
              const m: Metrics = JSON.parse(r.metricsJson);
              return <span className="tabular-nums">{(m.test.f1_macro * 100).toFixed(1)}%</span>;
            },
          },
          { title: 'Số mẫu', dataIndex: 'nSamples', className: 'tabular-nums' },
          {
            title: 'Huấn luyện lúc',
            dataIndex: 'trainedAt',
            render: (v: string) => new Date(v).toLocaleString('vi-VN'),
          },
          { title: 'Ghi chú', dataIndex: 'note', render: (v: string | null) => v ?? '—' },
          {
            title: '',
            render: (_: unknown, r: ModelVersionRow) => (
              <Button size="small" icon={<HistoryOutlined />} onClick={() => setDetail(r)}>
                Xem chi tiết
              </Button>
            ),
          },
        ]}
      />

      <Drawer title={`Chi tiết phiên bản ${detail?.version ?? ''}`} open={!!detail} onClose={() => setDetail(null)} width={640}>
        {detail && metrics && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status]}</Tag>
              {detail.status !== 'CHAMPION' && (
                <Button
                  type="primary"
                  size="small"
                  style={{ marginLeft: 8 }}
                  icon={<CheckCircleOutlined />}
                  loading={busyVersion === detail.version}
                  onClick={() => promote(detail.version)}
                >
                  Đưa vào sử dụng
                </Button>
              )}
              {detail.status === 'ARCHIVED' && (
                <Button
                  size="small"
                  style={{ marginLeft: 8 }}
                  loading={busyVersion === detail.version}
                  onClick={() => rollback(detail.version)}
                >
                  Quay lại phiên bản này
                </Button>
              )}
            </div>

            <h4>So với đường cơ sở (baseline)</h4>
            <Table
              size="small"
              pagination={false}
              dataSource={[
                { name: 'Mô hình kNN (đã tối ưu)', f1: metrics.test.f1_macro },
                { name: 'Đoán ngẫu nhiên có trọng số', f1: metrics.baseline.dummy_f1_macro },
                { name: 'Luật đơn giản (rule-based)', f1: metrics.baseline.rule_f1_macro },
              ]}
              columns={[
                { title: 'Cách làm', dataIndex: 'name' },
                { title: 'macro-F1', dataIndex: 'f1', render: (v: number) => `${(v * 100).toFixed(1)}%` },
              ]}
            />

            <h4 style={{ marginTop: 20 }}>Đường cong chọn k (5-fold CV)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics.k_curve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" label={{ value: 'k (số láng giềng)', position: 'insideBottom', offset: -4 }} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} labelFormatter={(k) => `k=${k}`} />
                {params?.knn__n_neighbors != null && (
                  <ReferenceLine x={params.knn__n_neighbors as number} stroke={t.primary700} strokeDasharray="4 4" label="k đã chọn" />
                )}
                <Line type="monotone" dataKey="f1_macro_mean" stroke={t.primary700} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>

            <h4 style={{ marginTop: 20 }}>Precision / Recall / F1 theo từng phân khúc</h4>
            <Table
              size="small"
              pagination={false}
              dataSource={metrics.test.labels.map((l) => ({ key: l, label: segmentColors[l]?.label ?? l, ...metrics.test.report[l] }))}
              columns={[
                { title: 'Phân khúc', dataIndex: 'label' },
                { title: 'Precision', dataIndex: 'precision', className: 'tabular-nums', render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: 'Recall', dataIndex: 'recall', className: 'tabular-nums', render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: 'F1-score', dataIndex: 'f1-score', className: 'tabular-nums', render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: 'Số mẫu (support)', dataIndex: 'support', className: 'tabular-nums' },
              ]}
            />

            <h4 style={{ marginTop: 20 }}>Ma trận nhầm lẫn (confusion matrix)</h4>
            <Table
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={metrics.test.confusion_matrix.map((row, i) => ({
                key: metrics.test.labels[i],
                actual: segmentColors[metrics.test.labels[i]]?.label ?? metrics.test.labels[i],
                ...Object.fromEntries(row.map((v, j) => [metrics.test.labels[j], v])),
              }))}
              columns={[
                { title: 'Thực tế \\ Dự đoán', dataIndex: 'actual', fixed: 'left' },
                ...metrics.test.labels.map((l) => ({
                  title: segmentColors[l]?.label ?? l,
                  dataIndex: l,
                  className: 'tabular-nums',
                  render: (v: number, row: any) => (
                    <span style={{ fontWeight: row.actual === (segmentColors[l]?.label ?? l) ? 700 : 400 }}>{v}</span>
                  ),
                })),
              ]}
            />
            <Alert
              style={{ marginTop: 8 }}
              type="info"
              showIcon
              message="Đường chéo (số in đậm) là số dự đoán ĐÚNG. Càng nhiều số ngoài đường chéo, mô hình càng hay nhầm giữa 2 phân khúc đó."
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
