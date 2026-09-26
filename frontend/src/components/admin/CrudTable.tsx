import { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, message } from 'antd';
import { api } from '../../lib/api';

export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface CrudField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { label: string; value: number | string }[]; // cho type = 'select'
  hideInTable?: boolean;
  hideInForm?: boolean;
}

/** Bang CRUD dung chung: 1 component phuc vu nhieu thuc the (Brand, CPU/GPU Benchmark, Laptop)
 * thay vi viet rieng tung man - tiet kiem code nhung van goi dung API/quyen da co san o backend. */
export function CrudTable({
  title,
  endpoint,
  listEndpoint,
  fields,
  transformSubmit,
}: {
  title: string;
  /** Duong dan goc dung cho POST/PUT/DELETE, vd "/brands" (khong kem query string). */
  endpoint: string;
  /** Duong dan dung rieng cho GET danh sach, vd "/laptops?pageSize=500". Mac dinh = endpoint. */
  listEndpoint?: string;
  fields: CrudField[];
  transformSubmit?: (values: any) => any;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  function load() {
    setLoading(true);
    api
      .get(listEndpoint ?? endpoint)
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được danh sách. Kiểm tra mạng và thử lại.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [endpoint, listEndpoint]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    form.setFieldsValue(row);
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const payload = transformSubmit ? transformSubmit(values) : values;
    try {
      if (editing) {
        await api.put(`${endpoint}/${editing.id}`, payload);
        message.success('Đã cập nhật.');
      } else {
        await api.post(endpoint, payload);
        message.success('Đã thêm mới.');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không lưu được, vui lòng thử lại.');
    }
  }

  async function handleDelete(row: any) {
    try {
      await api.delete(`${endpoint}/${row.id}`);
      message.success('Đã xóa.');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không xóa được.');
    }
  }

  const columns = [
    ...fields
      .filter((f) => !f.hideInTable)
      .map((f) => ({
        title: f.label,
        dataIndex: f.key,
        key: f.key,
        render: (v: any) =>
          f.type === 'boolean' ? (v ? 'Có' : 'Không') : f.type === 'select' ? (f.options?.find((o) => o.value === v)?.label ?? v) : v,
      })),
    {
      title: '',
      key: 'actions',
      render: (_: any, row: any) => (
        <>
          <Button size="small" onClick={() => openEdit(row)} style={{ marginRight: 8 }}>
            Sửa
          </Button>
          <Popconfirm title="Xóa mục này?" onConfirm={() => handleDelete(row)} okText="Xóa" cancelText="Hủy">
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <Button type="primary" onClick={openCreate}>
          + Thêm mới
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          {fields
            .filter((f) => !f.hideInForm)
            .map((f) => (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={f.required ? [{ required: true, message: `Vui lòng nhập ${f.label}` }] : []}>
                {f.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : f.type === 'boolean' ? (
                  <Switch />
                ) : f.type === 'select' ? (
                  <Select options={f.options} />
                ) : (
                  <Input />
                )}
              </Form.Item>
            ))}
        </Form>
      </Modal>
    </div>
  );
}
