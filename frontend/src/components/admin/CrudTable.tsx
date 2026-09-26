import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Upload, message } from 'antd';
import { UploadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
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
 * thay vi viet rieng tung man - tiet kiem code nhung van goi dung API/quyen da co san o backend.
 * Co san: tim kiem (loc client-side tren du lieu da tai), xuat/nhap Excel, form dang luoi 2 cot. */
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
  const [searchText, setSearchText] = useState('');
  const [importing, setImporting] = useState(false);
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

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return rows;
    const q = searchText.trim().toLowerCase();
    return rows.filter((row) =>
      fields.some((f) => {
        const raw = row[f.key];
        // Truong 'select' (vd gpuId=14) phai so theo NHAN hien thi ("NVIDIA GeForce RTX 4070"),
        // khong phai so voi ID so - nguoi dung go ten may/linh kien, khong go ID.
        const display = f.type === 'select' ? f.options?.find((o) => o.value === raw)?.label ?? raw : raw;
        return String(display ?? '').toLowerCase().includes(q);
      })
    );
  }, [rows, searchText, fields]);

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

  function exportLabel(f: CrudField, value: any) {
    if (f.type === 'boolean') return value ? 1 : 0;
    if (f.type === 'select') return f.options?.find((o) => o.value === value)?.label ?? value;
    return value;
  }

  function handleExport() {
    const exportFields = fields.filter((f) => !f.hideInTable || f.key === 'id');
    const data = filteredRows.map((row) =>
      Object.fromEntries(exportFields.map((f) => [f.label, exportLabel(f, row[f.key])]))
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  }

  /** Nhap hang loat tu Excel/CSV: cot phai dat ten dung `field.label` (giong file xuat ra ->
   * co the sua truc tiep file da xuat roi nhap lai). Moi dong goi POST rieng (phu hop quy mo
   * quan tri vai tram dong; du lieu lon hon nen lam API nhap hang loat rieng o backend). */
  async function handleImport(file: File) {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      const importFields = fields.filter((f) => !f.hideInForm);

      let success = 0;
      let failed = 0;
      for (const jsonRow of jsonRows) {
        const payload: Record<string, any> = {};
        for (const f of importFields) {
          const raw = jsonRow[f.label];
          if (raw === undefined || raw === '') continue;
          if (f.type === 'boolean') payload[f.key] = raw === 1 || raw === true || raw === 'Có';
          else if (f.type === 'number' || f.type === 'select') payload[f.key] = Number(raw);
          else payload[f.key] = String(raw);
        }
        try {
          await api.post(endpoint, transformSubmit ? transformSubmit(payload) : payload);
          success += 1;
        } catch {
          failed += 1;
        }
      }
      message.success(`Nhập xong: ${success} dòng thành công${failed ? `, ${failed} dòng lỗi` : ''}.`);
      load();
    } catch {
      message.error('Không đọc được file. Kiểm tra định dạng .xlsx/.csv và tên cột (phải khớp tiêu đề đã xuất).');
    } finally {
      setImporting(false);
    }
    return false; // ngan Upload tu upload len server mac dinh
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
      fixed: 'right' as const,
      width: 140,
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

  const formFields = fields.filter((f) => !f.hideInForm);
  const useGrid = formFields.length > 4;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            placeholder="Tìm kiếm..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Xuất Excel
          </Button>
          <Upload
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={handleImport}
            disabled={importing}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Nhập Excel
            </Button>
          </Upload>
          <Button type="primary" onClick={openCreate}>
            + Thêm mới
          </Button>
        </div>
      </div>

      {searchText && (
        <div style={{ marginBottom: 8, color: '#4A5B73', fontSize: 13 }}>
          Tìm thấy {filteredRows.length}/{rows.length} dòng khớp "{searchText}"
        </div>
      )}

      <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredRows} pagination={{ pageSize: 10 }} scroll={{ x: true }} />

      <Modal
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Lưu"
        cancelText="Hủy"
        width={useGrid ? 720 : 480}
      >
        <Form form={form} layout="vertical">
          <div
            style={
              useGrid
                ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }
                : undefined
            }
          >
            {formFields.map((f) => (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={f.required ? [{ required: true, message: `Vui lòng nhập ${f.label}` }] : []}>
                {f.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : f.type === 'boolean' ? (
                  <Switch />
                ) : f.type === 'select' ? (
                  <Select options={f.options} showSearch optionFilterProp="label" />
                ) : (
                  <Input />
                )}
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
