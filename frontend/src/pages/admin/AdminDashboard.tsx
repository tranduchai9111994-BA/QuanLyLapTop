import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Statistic, Table, Tag, message } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  LikeOutlined,
  ReloadOutlined,
  ScanOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';

interface Kpis {
  totalSessions: number;
  fallbackRate: number;
  avgLatencyMs: number;
  likeRate: number | null;
  likeCount: number;
  dislikeCount: number;
}

interface AlertRow {
  id: number;
  code: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  value: number | null;
  threshold: number | null;
  createdAt: string;
}

const SEVERITY_COLOR: Record<string, string> = { INFO: 'blue', WARN: 'orange', CRITICAL: 'red' };

/** FR-14 Dashboard (UC-14): tong quan suc khoe he thong cho quan tri vien - KPI 30 ngay gan nhat
 * + danh sach canh bao dang mo (tinh boi `alertScan` - backend/src/modules/jobs/alertScan.ts,
 * chay tu dong moi gio, hoac bam "Quet ngay" o day de kiem tra tuc thi). Day la man DUY NHAT
 * gom du 6 chi so thanh cong cua de tai (docs/09 SS6) tren cung 1 man hinh. */
export function AdminDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [reviewBacklog, setReviewBacklog] = useState<number>(0);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/kpis'),
      api.get('/dashboard/alerts'),
      api.get('/labels/review-queue'),
    ])
      .then(([k, a, q]) => {
        setKpis(k.data.data);
        setAlerts(a.data.data);
        setReviewBacklog(q.data.data.length);
      })
      .catch(() => message.error('Không tải được dữ liệu Dashboard.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function scanNow() {
    setScanning(true);
    try {
      const r = await api.post('/dashboard/alerts/scan');
      setAlerts(r.data.data);
      message.success('Đã quét xong — danh sách cảnh báo đã cập nhật.');
    } catch {
      message.error('Quét thất bại.');
    } finally {
      setScanning(false);
    }
  }

  async function resolve(id: number) {
    try {
      await api.patch(`/dashboard/alerts/${id}/resolve`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      message.error('Không đánh dấu xử lý được.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <div>
          <Button icon={<ReloadOutlined />} onClick={load} style={{ marginRight: 8 }}>
            Tải lại
          </Button>
          <Button type="primary" icon={<ScanOutlined />} loading={scanning} onClick={scanNow}>
            Quét cảnh báo ngay
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Lượt tư vấn (30 ngày)" value={kpis?.totalSessions ?? 0} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="Tỷ lệ hài lòng (👍 / 👍+👎)"
              value={kpis?.likeRate != null ? Math.round(kpis.likeRate * 100) : undefined}
              suffix="%"
              prefix={<LikeOutlined />}
              valueStyle={{ color: kpis?.likeRate != null && kpis.likeRate < 0.4 ? t.error : t.success }}
            />
            {kpis && <div style={{ color: t.textTertiary, fontSize: 12 }}>{kpis.likeCount} 👍 · {kpis.dislikeCount} 👎</div>}
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="Độ trễ trung bình"
              value={kpis ? Math.round(kpis.avgLatencyMs) : undefined}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: kpis && kpis.avgLatencyMs > 800 ? t.error : t.success }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title="Tỷ lệ dùng chế độ dự phòng"
              value={kpis ? Math.round(kpis.fallbackRate * 1000) / 10 : undefined}
              suffix="%"
              prefix={<WarningOutlined />}
              valueStyle={{ color: kpis && kpis.fallbackRate > 0.05 ? t.error : t.success }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Nhãn đang chờ xác minh" value={reviewBacklog} prefix={<CheckCircleOutlined />} valueStyle={{ color: reviewBacklog > 20 ? t.warning : undefined }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic title="Tổng phản hồi" value={(kpis?.likeCount ?? 0) + (kpis?.dislikeCount ?? 0)} />
          </Card>
        </Col>
      </Row>

      <h3>Cảnh báo đang mở</h3>
      {!loading && alerts.length === 0 && (
        <Alert type="success" showIcon message="Không có cảnh báo nào — hệ thống đang vận hành ổn định." style={{ marginBottom: 16 }} />
      )}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={alerts}
        pagination={false}
        columns={[
          { title: 'Mức', dataIndex: 'severity', render: (v: string) => <Tag color={SEVERITY_COLOR[v]}>{v}</Tag> },
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Nội dung', dataIndex: 'message' },
          { title: 'Lúc', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
          {
            title: '',
            render: (_: unknown, r: AlertRow) => (
              <Button size="small" onClick={() => resolve(r.id)}>
                Đánh dấu đã xử lý
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
