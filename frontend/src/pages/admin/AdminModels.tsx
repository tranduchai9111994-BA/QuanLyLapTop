import { useEffect, useState } from 'react';
import { formatDateTime } from '../../utils/format';
import { Alert, Button, Card, Collapse, Input, Modal, Popconfirm, Radio, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, HistoryOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
  /** fold_scores: macro-F1 của 5 phần CV; chỉ có ở phiên bản huấn luyện sau khi bổ sung trường này. */
  cv: { f1_macro_mean: number; f1_macro_std: number; fold_scores?: number[] };
  test: TestMetrics;
  /** rule_confusion_matrix: chỉ có ở phiên bản huấn luyện sau khi bổ sung trường này. */
  baseline: { dummy_f1_macro: number; rule_f1_macro: number; rule_confusion_matrix?: number[][] };
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

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt4 = (v: number) => v.toFixed(4);
const CELL_TP = t.warningBg; // ô đoán đúng của phân khúc đang chọn
const CELL_LINE = t.primary100; // cả hàng và cột của phân khúc đang chọn

const STATUS_COLOR: Record<string, string> = { CHAMPION: 'green', CHALLENGER: 'blue', ARCHIVED: 'default' };
const STATUS_LABEL: Record<string, string> = { CHAMPION: 'Đang sử dụng', CHALLENGER: 'Dự phòng', ARCHIVED: 'Đã lưu trữ' };

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
  const [baselineView, setBaselineView] = useState<'dummy' | 'rule' | null>(null); // cửa sổ giải thích cách ra điểm của 2 đường cơ sở
  const [focus, setFocus] = useState<string | null>(null); // phân khúc đang tô sáng trong bảng giải thích Precision/Recall

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
      message.success('Huấn luyện xong — phiên bản mới ở trạng thái "Dự phòng", chưa tự động dùng cho khách.');
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

  async function remove(version: string) {
    try {
      await api.delete(`/models/${version}`);
      message.success(`Đã xóa phiên bản ${version}.`);
      if (detail?.version === version) setDetail(null);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không xóa được phiên bản này.');
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

  // Số liệu cho phần "Cách tính" trong cửa sổ chi tiết: tính lại từ ma trận nhầm lẫn (hàng = thực tế, cột = dự đoán)
  const labels = metrics?.test.labels ?? [];
  const cm = metrics?.test.confusion_matrix ?? [];
  const f1Rows = labels.map((l, i) => {
    const tp = cm[i]?.[i] ?? 0;
    const rowSum = (cm[i] ?? []).reduce((a, b) => a + b, 0);
    const colSum = cm.reduce((a, row) => a + (row[i] ?? 0), 0);
    const p = colSum > 0 ? tp / colSum : 0;
    const r = rowSum > 0 ? tp / rowSum : 0;
    return { key: l, idx: i, label: segmentColors[l]?.label ?? l, tp, rowSum, colSum, p, r, f1: p + r > 0 ? (2 * p * r) / (p + r) : 0 };
  });
  const testSupport = cm.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);
  // Cách tính CV: 5 phần trên tập học (tập học = tổng số máy trừ máy thi)
  const nTrain = (detail?.nSamples ?? 0) - testSupport;
  const foldSize = Math.round(nTrain / 5);
  const folds = metrics?.cv.fold_scores;
  const foldMean = folds?.length ? folds.reduce((a, b) => a + b, 0) / folds.length : 0;
  const foldStd = folds?.length ? Math.sqrt(folds.reduce((a, b) => a + (b - foldMean) ** 2, 0) / folds.length) : 0;
  const focusRow = f1Rows.find((r) => r.key === focus) ?? null;
  // Liệt kê các ô sai của phân khúc thứ i: theo hàng = máy thật bị đoán thành phân khúc nào; theo cột = máy bị gọi vào đây thật ra thuộc phân khúc nào
  const wrongAs = (i: number, by: 'row' | 'col') =>
    f1Rows
      .filter((x) => x.idx !== i)
      .map((x) => ({ name: x.label, n: by === 'row' ? (cm[i]?.[x.idx] ?? 0) : (cm[x.idx]?.[i] ?? 0) }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} máy ${by === 'row' ? 'bị gọi là' : 'thật ra là'} ${x.name}`)
      .join(', ');
  // Đường cơ sở "luôn đoán đông nhất": mọi máy đều bị gọi là phân khúc đông nhất, nên mọi số đếm dồn vào cột đó (dựng lại từ số máy mỗi phân khúc)
  const dummyRow = f1Rows.reduce<(typeof f1Rows)[number] | null>((best, r) => (best === null || r.rowSum > best.rowSum ? r : best), null);
  const dummyName = dummyRow?.label ?? '';
  const dummyCm = f1Rows.map((r) => f1Rows.map((c) => (c.idx === dummyRow?.idx ? r.rowSum : 0)));
  const ruleCm = metrics?.baseline.rule_confusion_matrix;
  const macroComputed = f1Rows.length ? f1Rows.reduce((a, r) => a + r.f1, 0) / f1Rows.length : 0;
  // k đã chọn và các k đứng cạnh có điểm nằm trong khoảng dao động (± độ lệch) của k đã chọn
  const chosenK = metrics?.k_curve.find((c) => c.k === params?.knn__n_neighbors);
  const closeK = chosenK
    ? metrics!.k_curve.filter((c) => c.k !== chosenK.k && Math.abs(c.k - chosenK.k) <= 2 && chosenK.f1_macro_mean - c.f1_macro_mean <= chosenK.f1_macro_std)
    : [];

  return (
    <div>
      <h2>Quản lý mô hình (Mô hình A — phân loại phân khúc)</h2>
      <p style={{ color: t.textSecondary }}>
        Mỗi lần huấn luyện tạo ra một bản "dự phòng" mới — không tự động thay mô hình đang phục vụ
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
            render: (v: string) => formatDateTime(v),
          },
          { title: 'Ghi chú', dataIndex: 'note', render: (v: string | null) => v ?? '—' },
          {
            title: '',
            render: (_: unknown, r: ModelVersionRow) => (
              <>
                <Button size="small" icon={<HistoryOutlined />} onClick={() => setDetail(r)}>
                  Xem chi tiết
                </Button>
                {r.status !== 'CHAMPION' && ( // bản đang dùng không được xóa
                  <Popconfirm
                    title="Xóa phiên bản này?"
                    description="Xóa cả file mô hình trên đĩa, không khôi phục được."
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(r.version)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} style={{ marginLeft: 8 }}>
                      Xóa
                    </Button>
                  </Popconfirm>
                )}
              </>
            ),
          },
        ]}
      />

      <Modal
        title={`Chi tiết phiên bản ${detail?.version ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width="min(1300px, 96vw)" // rộng để các bảng giải thích số liệu không bị bó hẹp
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', fontSize: 15 } }}
      >
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

            <h4>Tóm tắt kết quả (macro-F1)</h4>
            <Table
              size="small"
              pagination={false}
              dataSource={[
                {
                  key: 'cv',
                  name: 'Kiểm tra chéo 5 phần (CV) trên tập học',
                  v: `${pct1(metrics.cv.f1_macro_mean)} ± ${pct1(metrics.cv.f1_macro_std)}`,
                  note: 'Chia tập học làm 5 phần, lần lượt học 4 phần và thi 1 phần, lấy trung bình 5 lần.',
                },
                {
                  key: 'test',
                  name: `Thi trên ${testSupport} máy chưa từng thấy (test)`,
                  v: pct1(metrics.test.f1_macro),
                  note: 'Tập thi giữ riêng từ đầu, không dùng để chọn k hay chuẩn hóa.',
                },
              ]}
              columns={[
                { title: 'Cách kiểm tra', dataIndex: 'name' },
                { title: 'macro-F1', dataIndex: 'v', className: 'tabular-nums' },
                { title: 'Ý nghĩa', dataIndex: 'note' },
              ]}
            />
            <Alert
              style={{ marginTop: 8 }}
              type={Math.abs(metrics.cv.f1_macro_mean - metrics.test.f1_macro) <= 0.05 ? 'success' : 'warning'}
              showIcon
              message={
                Math.abs(metrics.cv.f1_macro_mean - metrics.test.f1_macro) <= 0.05
                  ? `CV (${pct1(metrics.cv.f1_macro_mean)}) và test (${pct1(metrics.test.f1_macro)}) gần nhau: mô hình không bị học thuộc tập học.`
                  : `CV (${pct1(metrics.cv.f1_macro_mean)}) và test (${pct1(metrics.test.f1_macro)}) lệch hơn 5 điểm %: cần xem lại nguy cơ học thuộc hoặc tập thi quá nhỏ.`
              }
            />
            <h4 style={{ marginTop: 28 }}>1. Chọn k bằng kiểm tra chéo (CV) trên tập học</h4>
            <p style={{ color: t.textSecondary, marginTop: 0 }}>
              Với mỗi k, chia tập học làm 5 phần, học 4 thi 1 rồi lấy trung bình macro-F1; chọn k cho điểm cao nhất.
            </p>
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
            {chosenK && (
              <Alert
                style={{ marginTop: 8 }}
                type="info"
                showIcon
                message={`k = ${chosenK.k}: macro-F1 ${pct1(chosenK.f1_macro_mean)} ± ${pct1(chosenK.f1_macro_std)} (độ lệch giữa 5 lần).`}
                description={
                  closeK.length > 0
                    ? `Các k đứng ngay cạnh nằm trong khoảng dao động này (${closeK.map((c) => `k=${c.k}: ${pct1(c.f1_macro_mean)}`).join('; ')}), nên chọn k nào gần đó kết quả cũng tương đương, không phải mô hình nhạy cảm với k.`
                    : 'Các k đứng cạnh thấp hơn rõ so với dao động này, nên k được chọn có lý do rõ ràng.'
                }
              />
            )}
            <Collapse style={{ marginTop: 8 }} size="small" items={[
                {
                  key: 'cv',
                  label: `Cách tính CV (${pct1(metrics.cv.f1_macro_mean)} ± ${pct1(metrics.cv.f1_macro_std)} ra từ đâu)`,
                  children: (
                    <div>
                      <p style={{ marginTop: 0 }}>
                        CV chỉ dùng <strong>{nTrain} máy của tập học</strong>, không đụng tới {testSupport} máy thi. Các bước:
                      </p>
                      <ol style={{ marginTop: 0 }}>
                        <li>Chia {nTrain} máy ngẫu nhiên thành <strong>5 phần</strong>, mỗi phần {foldSize} máy (giữ đều tỷ lệ 4 phân khúc).</li>
                        <li>
                          Lần 1: lấy phần 1 làm bài thi ({foldSize} máy), 4 phần còn lại ({nTrain - foldSize} máy) để học, rồi tính macro-F1 trên {foldSize} máy thi đó. Cách tính
                          macro-F1 giống hệt phần test ở trên.
                        </li>
                        <li>Lặp lại 5 lần, mỗi lần một phần khác làm bài thi, ra <strong>5 điểm macro-F1</strong>.</li>
                        <li>
                          <strong>Trung bình</strong> của 5 điểm là {pct1(metrics.cv.f1_macro_mean)}; <strong>độ lệch chuẩn</strong> của 5 điểm là {pct1(metrics.cv.f1_macro_std)} (cho biết điểm
                          dao động bao nhiêu giữa các lần chia).
                        </li>
                      </ol>
                      {folds && folds.length > 0 ? (
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={[
                            ...folds.map((s, i) => ({ key: i, name: `Lần ${i + 1}`, learn: nTrain - foldSize, exam: foldSize, v: pct1(s), dev: `(${fmt4(s)} − ${fmt4(foldMean)})² = ${fmt4((s - foldMean) ** 2)}` })),
                          ]}
                          columns={[
                            { title: 'Lần', dataIndex: 'name' },
                            { title: 'Máy dùng để học', dataIndex: 'learn', className: 'tabular-nums' },
                            { title: 'Máy dùng để thi', dataIndex: 'exam', className: 'tabular-nums' },
                            { title: 'macro-F1 của lần này', dataIndex: 'v', className: 'tabular-nums' },
                            { title: 'Lệch so với trung bình, bình phương', dataIndex: 'dev', className: 'tabular-nums' },
                          ]}
                          summary={() => (
                            <>
                              <Table.Summary.Row style={{ background: t.bgSubtle }}>
                                <Table.Summary.Cell index={0} colSpan={3}>
                                  <strong>Trung bình = ({folds.map((s) => fmt4(s)).join(' + ')}) ÷ {folds.length}</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} colSpan={2}>
                                  <strong>{fmt4(foldMean)}</strong> ≈ {pct1(foldMean)}
                                </Table.Summary.Cell>
                              </Table.Summary.Row>
                              <Table.Summary.Row style={{ background: t.bgSubtle }}>
                                <Table.Summary.Cell index={0} colSpan={3}>
                                  <strong>Độ lệch chuẩn = √(tổng bình phương lệch ÷ {folds.length})</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} colSpan={2}>
                                  <strong>{fmt4(foldStd)}</strong> ≈ {pct1(foldStd)}
                                </Table.Summary.Cell>
                              </Table.Summary.Row>
                            </>
                          )}
                        />
                      ) : (
                        <Alert type="warning" showIcon message="Phiên bản này chưa lưu điểm của từng lần. Huấn luyện một phiên bản mới để hiện bảng 5 lần với số thật." />
                      )}
                      <Alert
                        style={{ marginTop: 8 }}
                        type="info"
                        showIcon
                        message="Vì sao có cả CV lẫn test?"
                        description="CV dùng để chọn tham số (k, cách đo khoảng cách, trọng số phiếu): thử 64 tổ hợp, mỗi tổ hợp chấm bằng 5 lần như trên, tổ hợp nào trung bình cao nhất thì chọn. Vì tập học đã được dùng để chọn nên cần thêm tập thi giữ riêng để chấm lần cuối. CV và test gần nhau thì mô hình ổn định."
                      />
                    </div>
                  ),
                },
            ]} />
            <h4 style={{ marginTop: 28 }}>2. Chấm điểm cuối trên tập thi (test)</h4>
            <div>
              <Alert
                style={{ marginBottom: 12 }}
                type="info"
                showIcon
                message={`Các số đếm dưới đây là trên ${testSupport} máy thi, không phải toàn bộ ${detail?.nSamples ?? ''} máy. Các máy còn lại là tập học nên không dùng để chấm điểm.`}
                description={`Tổng số đoán đúng (TP) = ${f1Rows.map((r) => r.tp).join(' + ')} = ${f1Rows.reduce((a, r) => a + r.tp, 0)} trên ${testSupport} máy, tức đúng ${pct1(testSupport ? f1Rows.reduce((a, r) => a + r.tp, 0) / testSupport : 0)} (accuracy). macro-F1 thấp hơn accuracy khi có phân khúc yếu, vì macro-F1 coi mọi phân khúc ngang nhau còn accuracy bị các phân khúc đông che đi.`}
              />
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                Ma trận nhầm lẫn kèm tổng hàng và tổng cột
              </Typography.Title>
              <p style={{ marginTop: 0 }}>
                Hàng = phân khúc <strong>thực tế</strong>, cột = phân khúc <strong>mô hình đoán</strong>. Chọn một phân khúc để tô sáng hàng và cột của nó.
              </p>
              <Radio.Group style={{ marginBottom: 8 }} value={focus}>
                {f1Rows.map((r) => (
                  // Bấm lại phân khúc đang chọn thì bỏ chọn (Radio mặc định không tự bỏ)
                  <Radio.Button key={r.key} value={r.key} onClick={() => setFocus(focus === r.key ? null : r.key)}>
                    {r.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <Table
                size="small"
                pagination={false}
                bordered
                dataSource={[
                  ...f1Rows.map((r, i) => ({ key: r.key, actual: r.label, label: r.key, vals: cm[i] ?? [], total: r.rowSum })),
                  { key: 'sum', actual: 'Cộng cột', label: 'sum', vals: f1Rows.map((r) => r.colSum), total: testSupport },
                ]}
                columns={[
                  {
                    title: 'Thực tế \\ Mô hình đoán',
                    dataIndex: 'actual',
                    onCell: (row: { label: string }) => ({ style: { fontWeight: 600, background: focus === row.label ? CELL_LINE : undefined } }),
                  },
                  ...f1Rows.map((c, j) => ({
                    title: c.label,
                    align: 'right' as const,
                    className: 'tabular-nums',
                    onHeaderCell: () => ({ style: { background: focus === c.key ? CELL_LINE : undefined } }),
                    onCell: (row: { label: string }) => ({
                      style: {
                        background: focus && row.label === focus && c.key === focus ? CELL_TP : focus && (row.label === focus || c.key === focus) ? CELL_LINE : undefined,
                        fontWeight: row.label === c.key || row.label === 'sum' ? 700 : 400, // đường chéo (đoán đúng) và hàng cộng cột in đậm
                      },
                    }),
                    render: (_: unknown, row: { vals: number[] }) => row.vals[j],
                  })),
                  { title: 'Cộng hàng', dataIndex: 'total', align: 'right' as const, className: 'tabular-nums', render: (v: number) => <strong>{v}</strong> },
                ]}
              />
              {focusRow ? (
                <div style={{ marginTop: 8, marginBottom: 12 }}>
                  <Alert
                    style={{ marginBottom: 8 }}
                    type="info"
                    showIcon
                    message={
                      <span>
                        <strong>Đọc theo hàng (góc nhìn thực tế) → Recall.</strong> Thực tế có <strong>{focusRow.rowSum}</strong> máy {focusRow.label}. Mô hình đoán trúng{' '}
                        <strong>{focusRow.tp}</strong> máy.{' '}
                        {focusRow.rowSum - focusRow.tp === 0 ? (
                          'Không máy nào bị đoán sai.'
                        ) : (
                          <>
                            <strong>{focusRow.rowSum - focusRow.tp}</strong> máy còn lại bị đoán sai: {wrongAs(focusRow.idx, 'row')}.
                          </>
                        )}
                      </span>
                    }
                    description={`Recall = ${focusRow.tp} ÷ ${focusRow.rowSum} = ${fmt4(focusRow.r)}: trong các máy ${focusRow.label} thật, mô hình tìm ra được ${pct1(focusRow.r)}, bỏ sót ${pct1(1 - focusRow.r)}.`}
                  />
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span>
                        <strong>Đọc theo cột (góc nhìn của mô hình) → Precision.</strong> Mô hình gọi <strong>{focusRow.colSum}</strong> máy là {focusRow.label}. Trong đó đúng{' '}
                        <strong>{focusRow.tp}</strong> máy.{' '}
                        {focusRow.colSum - focusRow.tp === 0 ? (
                          'Không máy nào bị gọi nhầm vào phân khúc này.'
                        ) : (
                          <>
                            <strong>{focusRow.colSum - focusRow.tp}</strong> máy gọi sai, thật ra là: {wrongAs(focusRow.idx, 'col')}.
                          </>
                        )}
                      </span>
                    }
                    description={`Precision = ${focusRow.tp} ÷ ${focusRow.colSum} = ${fmt4(focusRow.p)}: mô hình đã gọi "${focusRow.label}" thì đúng ${pct1(focusRow.p)}.`}
                  />
                </div>
              ) : (
                <Alert style={{ marginTop: 8, marginBottom: 12 }} type="info" showIcon message="Chọn một phân khúc ở trên để xem hàng (thực tế) và cột (mô hình đoán) của nó được đọc ra sao. Ô vàng là đoán đúng." />
              )}

              <Typography.Title level={5}>Precision, Recall, F1 của từng phân khúc</Typography.Title>
              <p style={{ marginTop: 0 }}>
                <strong>Precision</strong> = đoán đúng ÷ cộng cột. <strong>Recall</strong> = đoán đúng ÷ cộng hàng. Số lấy thẳng từ bảng ma trận ở trên. F1 của một phân khúc = 2 × Precision × Recall ÷ (Precision + Recall). macro-F1 = trung bình cộng F1 của {labels.length} phân khúc, mỗi phân khúc có trọng số bằng nhau, nên phân khúc ít máy không bị lớp đông át đi (khác accuracy).
              </p>
              <Table
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                dataSource={f1Rows}
                columns={[
                  { title: 'Phân khúc', dataIndex: 'label' },
                  {
                    title: 'Precision = đúng ÷ cộng cột',
                    dataIndex: 'p',
                    className: 'tabular-nums',
                    render: (v: number, r: (typeof f1Rows)[number]) => `${r.tp} ÷ ${r.colSum} = ${fmt4(v)}`,
                  },
                  {
                    title: 'Recall = đúng ÷ cộng hàng',
                    dataIndex: 'r',
                    className: 'tabular-nums',
                    render: (v: number, r: (typeof f1Rows)[number]) => `${r.tp} ÷ ${r.rowSum} = ${fmt4(v)}`,
                  },
                  {
                    title: 'F1 = 2PR ÷ (P+R)',
                    dataIndex: 'f1',
                    className: 'tabular-nums',
                    render: (_: number, r: (typeof f1Rows)[number]) => `2 × ${fmt4(r.p)} × ${fmt4(r.r)} ÷ (${fmt4(r.p)} + ${fmt4(r.r)}) = ${fmt4(r.f1)}`,
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ background: t.bgSubtle }}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <strong>macro-F1 = ({f1Rows.map((r) => fmt4(r.f1)).join(' + ')}) ÷ {f1Rows.length}</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <strong>{fmt4(macroComputed)}</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
            <h4 style={{ marginTop: 28 }}>3. So với đường cơ sở (baseline)</h4>
            <Table
              size="small"
              pagination={false}
              dataSource={[
                { key: 'knn', name: 'Mô hình kNN (đã tối ưu)', f1: metrics.test.f1_macro },
                { key: 'dummy', name: 'Luôn đoán phân khúc đông nhất', f1: metrics.baseline.dummy_f1_macro }, // khớp DummyClassifier(strategy="most_frequent")
                { key: 'rule', name: 'Luật đơn giản (rule-based)', f1: metrics.baseline.rule_f1_macro },
              ]}
              columns={[
                { title: 'Cách làm', dataIndex: 'name' },
                { title: 'macro-F1', dataIndex: 'f1', render: (v: number) => `${(v * 100).toFixed(1)}%` },
                {
                  title: '',
                  render: (_: unknown, r: { key: string }) =>
                    r.key === 'knn' ? null : (
                      <Button size="small" onClick={() => setBaselineView(r.key as 'dummy' | 'rule')}>
                        Xem cách tính
                      </Button>
                    ),
                },
              ]}
            />
            <Modal
              open={baselineView !== null}
              onCancel={() => setBaselineView(null)}
              footer={null}
              centered
              destroyOnHidden
              width="min(1100px, 96vw)"
              title={baselineView === 'dummy' ? `Vì sao "luôn đoán phân khúc đông nhất" chỉ đạt ${pct1(metrics.baseline.dummy_f1_macro)}?` : `Vì sao "luật đơn giản" đạt ${pct1(metrics.baseline.rule_f1_macro)}?`}
              styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', fontSize: 15 } }}
            >
              {baselineView === 'dummy' && (
                <div>
                  <Alert
                    style={{ marginBottom: 12 }}
                    type="info"
                    showIcon
                    message={`Cách làm: không dùng thông số máy, cứ máy nào đưa vào cũng trả lời "${dummyName}" (phân khúc đông nhất trong tập học).`}
                    description={`Đây là mốc sàn: một mô hình dở nhất mà vẫn không cần học gì. Nếu kNN không hơn mốc này thì kNN vô dụng. Cho "đoán" ${testSupport} máy thi thì cả ${testSupport} máy đều được gọi là ${dummyName}.`}
                  />
                  <ConfusionExplain labels={labels} cm={dummyCm} />
                  <Alert
                    style={{ marginTop: 12 }}
                    type="success"
                    showIcon
                    message={`${dummyName} chiếm ${dummyRow?.rowSum ?? 0}/${testSupport} máy nên đoán đúng ${pct1(testSupport ? (dummyRow?.rowSum ?? 0) / testSupport : 0)} (accuracy). Nhưng ${labels.length - 1} phân khúc còn lại đúng 0 máy, F1 = 0, nên macro-F1 chỉ còn ${pct1(metrics.baseline.dummy_f1_macro)}.`}
                    description="Đây chính là lý do dùng macro-F1 thay cho accuracy: accuracy khoảng một phần ba nghe không quá tệ, còn macro-F1 thấp hơn nhiều cho thấy mô hình này bỏ qua hoàn toàn 3 phân khúc."
                  />
                </div>
              )}
              {baselineView === 'rule' && (
                <div>
                  <Alert
                    style={{ marginBottom: 12 }}
                    type="info"
                    showIcon
                    message="Cách làm: một chuỗi if-else viết tay, xét theo thứ tự, máy khớp luật nào trước thì lấy nhãn đó."
                    description={
                      <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                        <li>Có card rời <strong>và</strong> tần số quét ≥ 120 Hz, thì là <strong>Gaming</strong>.</li>
                        <li>Không thì: màn chuẩn màu sRGB 100% <strong>và</strong> CPU thuộc nhóm 30% mạnh nhất, thì là <strong>Đồ họa – Kỹ thuật</strong>.</li>
                        <li>Không thì: nặng ≤ 1,4 kg, thì là <strong>Mỏng nhẹ – Di động</strong>.</li>
                        <li>Còn lại là <strong>Văn phòng – Học tập</strong>.</li>
                      </ol>
                    }
                  />
                  <Alert
                    style={{ marginBottom: 12 }}
                    type="info"
                    message="Ví dụ: máy có card rời, màn 144 Hz, nặng 2,3 kg khớp luật 1 nên bị gọi là Gaming, và đúng nếu máy đó thật sự là Gaming. Máy có màn sRGB 100%, CPU mạnh nhưng không có card rời thì rơi xuống luật 2 và được gọi là Đồ họa."
                  />
                  {ruleCm ? (
                    <>
                      <ConfusionExplain labels={labels} cm={ruleCm} />
                      <Alert
                        style={{ marginTop: 12 }}
                        type="success"
                        showIcon
                        message={`Luật đạt macro-F1 ${pct1(metrics.baseline.rule_f1_macro)}, còn kNN đạt ${pct1(metrics.test.f1_macro)}: kNN hơn ${((metrics.test.f1_macro - metrics.baseline.rule_f1_macro) * 100).toFixed(1)} điểm %.`}
                        description="Luật làm được khá vì phân khúc có quan hệ rõ với thông số, nhưng ngưỡng (120 Hz, 1,4 kg, CPU 70%) do người đặt cứng nên các máy gần ranh giới hay bị gọi nhầm. kNN thì so cả 11 thông số cùng lúc nên mềm hơn."
                      />
                    </>
                  ) : (
                    <Alert type="warning" showIcon message="Phiên bản này chưa lưu ma trận nhầm lẫn của luật. Huấn luyện một phiên bản mới để hiện bảng chi tiết với số thật." />
                  )}
                </div>
              )}
            </Modal>
          </>
        )}
      </Modal>
    </div>
  );
}

/**
 * Ma trận nhầm lẫn kèm cộng hàng/cộng cột, rồi Precision, Recall, F1 từng phân khúc và macro-F1 (cùng cách trình bày với phần giải thích của mô hình kNN).
 * `cm[i][j]` = số máy thực tế phân khúc i bị gọi là phân khúc j.
 */
function ConfusionExplain({ labels, cm }: { labels: string[]; cm: number[][] }) {
  const total = cm.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);
  const rows = labels.map((l, i) => {
    const tp = cm[i]?.[i] ?? 0;
    const rowSum = (cm[i] ?? []).reduce((a, b) => a + b, 0);
    const colSum = cm.reduce((a, row) => a + (row[i] ?? 0), 0);
    const p = colSum > 0 ? tp / colSum : 0;
    const r = rowSum > 0 ? tp / rowSum : 0;
    return { key: l, label: segmentColors[l]?.label ?? l, tp, rowSum, colSum, p, r, f1: p + r > 0 ? (2 * p * r) / (p + r) : 0 };
  });
  const macro = rows.length ? rows.reduce((a, r) => a + r.f1, 0) / rows.length : 0;
  type Row = (typeof rows)[number];

  return (
    <div>
      <p style={{ marginTop: 0 }}>
        Hàng = phân khúc <strong>thực tế</strong>, cột = phân khúc <strong>được đoán</strong>. Ô vàng là đoán đúng.
      </p>
      <Table
        size="small"
        pagination={false}
        bordered
        dataSource={[
          ...rows.map((r, i) => ({ key: r.key, actual: r.label, label: r.key, vals: cm[i] ?? [], total: r.rowSum })),
          { key: 'sum', actual: 'Cộng cột', label: 'sum', vals: rows.map((r) => r.colSum), total },
        ]}
        columns={[
          { title: 'Thực tế \ Được đoán', dataIndex: 'actual', onCell: () => ({ style: { fontWeight: 600 } }) },
          ...rows.map((c, j) => ({
            title: c.label,
            align: 'right' as const,
            className: 'tabular-nums',
            onCell: (row: { label: string }) => ({
              style: { background: row.label === c.key ? CELL_TP : undefined, fontWeight: row.label === c.key || row.label === 'sum' ? 700 : 400 },
            }),
            render: (_: unknown, row: { vals: number[] }) => row.vals[j],
          })),
          { title: 'Cộng hàng', dataIndex: 'total', align: 'right' as const, className: 'tabular-nums', render: (v: number) => <strong>{v}</strong> },
        ]}
      />
      <p style={{ marginBottom: 8 }}>
        <strong>Precision</strong> = đoán đúng ÷ cộng cột. <strong>Recall</strong> = đoán đúng ÷ cộng hàng. Phân khúc không được gọi lần nào (cộng cột = 0) thì Precision tính bằng 0.
      </p>
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={rows}
        columns={[
          { title: 'Phân khúc', dataIndex: 'label' },
          { title: 'Precision', className: 'tabular-nums', render: (_: unknown, r: Row) => `${r.tp} ÷ ${r.colSum} = ${fmt4(r.p)}` },
          { title: 'Recall', className: 'tabular-nums', render: (_: unknown, r: Row) => `${r.tp} ÷ ${r.rowSum} = ${fmt4(r.r)}` },
          {
            title: 'F1 = 2PR ÷ (P+R)',
            className: 'tabular-nums',
            render: (_: unknown, r: Row) => (r.p + r.r > 0 ? `2 × ${fmt4(r.p)} × ${fmt4(r.r)} ÷ (${fmt4(r.p)} + ${fmt4(r.r)}) = ${fmt4(r.f1)}` : 'P = R = 0 nên F1 = 0'),
          },
        ]}
        summary={() => (
          <Table.Summary.Row style={{ background: t.bgSubtle }}>
            <Table.Summary.Cell index={0} colSpan={3}>
              <strong>
                macro-F1 = ({rows.map((r) => fmt4(r.f1)).join(' + ')}) ÷ {rows.length}
              </strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1}>
              <strong>{fmt4(macro)}</strong>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </div>
  );
}
