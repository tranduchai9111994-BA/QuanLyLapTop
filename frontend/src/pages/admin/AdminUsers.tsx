import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Switch, Table, Tabs, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  role: 'STAFF' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  detailJson: string | null;
  createdAt: string;
  user: { fullName: string; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  UPDATE_CONFIG: 'Sửa cấu hình tri thức',
  PIN_LAPTOP: 'Ghim máy',
  BAN_LAPTOP: 'Cấm máy',
  UNPIN_LAPTOP: 'Gỡ ghim/cấm',
  PROMOTE_MODEL: 'Đưa mô hình vào sử dụng',
  ROLLBACK_MODEL: 'Quay lại phiên bản mô hình',
  DELETE_MODEL: 'Xóa phiên bản mô hình',
  CREATE_USER: 'Tạo tài khoản',
  UPDATE_USER: 'Sửa tài khoản',
};

/** UC-16 Quản lý người dùng, nhật ký (chỉ ADMIN): 2 tab — quản lý tài khoản STAFF/ADMIN nội bộ
 * (khách hàng tự đăng ký ở `/login`, không quản lý ở đây), và xem nhật ký các thao tác "nhạy
 * cảm" (sửa cấu hình tri thức, ghim/cấm máy, promote/rollback mô hình, tạo/sửa tài khoản) —
 * xem `backend/src/lib/audit.ts`, được các route tương ứng gọi khi thao tác thành công. */
export function AdminUsers() {
  return (
    <div>
      <h2>Quản lý người dùng & nhật ký</h2>
      <Tabs
        items={[
          { key: 'users', label: 'Tài khoản nội bộ', children: <UsersTab /> },
          { key: 'audit', label: 'Nhật ký hệ thống', children: <AuditTab /> },
        ]}
      />
    </div>
  );
}

function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const currentUserId: number | undefined = JSON.parse(localStorage.getItem('smartlap_user') ?? 'null')?.id;

  function load() {
    setLoading(true);
    api
      .get('/users')
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được danh sách tài khoản.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function createUser(values: { email: string; password: string; fullName: string; role: 'STAFF' | 'ADMIN' }) {
    setSaving(true);
    try {
      await api.post('/users', values);
      message.success('Đã tạo tài khoản.');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không tạo được tài khoản.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: UserRow) {
    try {
      await api.patch(`/users/${row.id}`, { isActive: !row.isActive });
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không cập nhật được.');
    }
  }

  async function changeRole(row: UserRow, role: 'STAFF' | 'ADMIN') {
    try {
      await api.patch(`/users/${row.id}`, { role });
      message.success(`Đã đổi quyền của ${row.fullName} sang ${role}.`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không đổi quyền được.');
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Thêm tài khoản
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Vai trò',
            dataIndex: 'role',
            render: (v: 'STAFF' | 'ADMIN', row: UserRow) => (
              <Select
                size="small"
                value={v}
                style={{ width: 110 }}
                disabled={row.id === currentUserId}
                onChange={(role) => changeRole(row, role)}
                options={[
                  { value: 'STAFF', label: 'Nhân viên' },
                  { value: 'ADMIN', label: 'Quản trị' },
                ]}
              />
            ),
          },
          {
            title: 'Đang hoạt động',
            dataIndex: 'isActive',
            render: (v: boolean, row: UserRow) => (
              <Switch checked={v} disabled={row.id === currentUserId} onChange={() => toggleActive(row)} />
            ),
          },
          { title: 'Tạo lúc', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
        ]}
      />

      <Modal
        title="Thêm tài khoản nội bộ"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Tạo"
      >
        <Form form={form} layout="vertical" onFinish={createUser} initialValues={{ role: 'STAFF' }}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6, message: 'Ít nhất 6 ký tự' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={[{ value: 'STAFF', label: 'Nhân viên' }, { value: 'ADMIN', label: 'Quản trị viên' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/audit-logs?limit=100')
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được nhật ký.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Lúc', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN'), width: 170 },
          { title: 'Người thực hiện', render: (_: unknown, r: AuditRow) => r.user?.fullName ?? '—' },
          { title: 'Hành động', dataIndex: 'action', render: (v: string) => <Tag>{ACTION_LABELS[v] ?? v}</Tag> },
          { title: 'Đối tượng', render: (_: unknown, r: AuditRow) => `${r.entity}${r.entityId ? ` #${r.entityId}` : ''}` },
          {
            title: 'Chi tiết',
            dataIndex: 'detailJson',
            render: (v: string | null) =>
              v ? <code style={{ fontSize: 12, color: t.textSecondary }}>{v.length > 120 ? `${v.slice(0, 120)}…` : v}</code> : '—',
          },
        ]}
      />
    </Card>
  );
}
