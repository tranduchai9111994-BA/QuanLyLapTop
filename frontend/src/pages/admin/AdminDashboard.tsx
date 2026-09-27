import { useEffect, useState } from 'react';
import { Alert, Button, Card, Statistic, Table, Tag, message } from 'antd';
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
  p95LatencyMs: number;
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
      {/* flexWrap: man hep (375px) khong du cho tieu de + 2 nut tren CUNG 1 hang - de tu xuong
          dong thay vi day tran ngang ca trang (phat hien khi kiem thu NFR-04 o Giai doan 7). */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        {/* display:flex + flexWrap tren CHINH nhom 2 nut nay - 2 the <Button> dung sat nhau
            trong JSX khong co khoang trang giua chung nen trinh duyet KHONG co diem ngat dong
            tu nhien (khac van ban thuong); phai tu khai bao flex-wrap moi xuong dong duoc. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={load}>
            Tải lại
          </Button>
          <Button type="primary" icon={<ScanOutlined />} loading={scanning} onClick={scanNow}>
            Quét cảnh báo ngay
          </Button>
        </div>
      </div>

      {/* CSS grid tu co dan (khong dung Row/Col span co dinh cua antd) - `auto-fit`/`minmax` tu
          giam so cot tren man hep thay vi giu nguyen 3 cot ep noi dung ben trong bi bop mop
          (phat hien khi kiem thu 375px o Giai doan 7: Card 118px khong du cho tieu de dai nhu
          "Độ trễ p95 (NFR-01: < 800ms)", lam noi dung tran ra ngoai Card). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card loading={loading}>
          <Statistic title="Lượt tư vấn (30 ngày)" value={kpis?.totalSessions ?? 0} prefix={<ThunderboltOutlined />} />
        </Card>
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
        <Card loading={loading}>
          <Statistic
            title="Độ trễ trung bình"
            value={kpis ? Math.round(kpis.avgLatencyMs) : undefined}
            suffix="ms"
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: kpis && kpis.avgLatencyMs > 800 ? t.error : t.success }}
          />
        </Card>
        <Card loading={loading}>
          {/* NFR-01: p95 < 800ms - so voi trung binh o tren, p95 phan anh dung trai nghiem
              CUA NGUOI DUNG CHAM NHAT, khong bi "trung binh keo" boi da so phien nhanh. */}
          <Statistic
            title="Độ trễ p95 (NFR-01: < 800ms)"
            value={kpis ? Math.round(kpis.p95LatencyMs) : undefined}
            suffix="ms"
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: kpis && kpis.p95LatencyMs > 800 ? t.error : t.success }}
          />
        </Card>
        <Card loading={loading}>
          <Statistic
            title="Tỷ lệ dùng chế độ dự phòng"
            value={kpis ? Math.round(kpis.fallbackRate * 1000) / 10 : undefined}
            suffix="%"
            prefix={<WarningOutlined />}
            valueStyle={{ color: kpis && kpis.fallbackRate > 0.05 ? t.error : t.success }}
          />
        </Card>
        <Card loading={loading}>
          <Statistic title="Nhãn đang chờ xác minh" value={reviewBacklog} prefix={<CheckCircleOutlined />} valueStyle={{ color: reviewBacklog > 20 ? t.warning : undefined }} />
        </Card>
        <Card loading={loading}>
          <Statistic title="Tổng phản hồi" value={(kpis?.likeCount ?? 0) + (kpis?.dislikeCount ?? 0)} />
        </Card>
      </div>

      <h3>Cảnh báo đang mở</h3>
      {!loading && alerts.length === 0 && (
        <Alert type="success" showIcon message="Không có cảnh báo nào — hệ thống đang vận hành ổn định." style={{ marginBottom: 16 }} />
      )}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={alerts}
        pagination={false}
        scroll={{ x: 'max-content' }}
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
