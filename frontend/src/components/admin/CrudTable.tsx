import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Upload, message } from 'antd';
import { UploadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface CrudField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { label: string; value: number | string }[]; // dùng cho type = 'select'
  hideInTable?: boolean;
  hideInForm?: boolean;
  /** Giới hạn cho ô nhập số, chặn giá trị vô lý (vd RAM âm) ngay trên giao diện. */
  min?: number;
  max?: number;
  step?: number;
  /** Số lớn: hiện dấu "." ngăn cách hàng nghìn (17180000 -> 17.180.000), chỉ ảnh hưởng hiển thị. */
  thousands?: boolean;
  /** Chú thích nhỏ dưới ô nhập. */
  help?: string;
  /** Tự tính giá trị hiện trong bảng từ cả dòng (khi giá trị không nằm ở `row[key]`). Nếu trả về
   * chuỗi thì ô tìm kiếm cũng tìm theo chuỗi này. */
  tableValue?: (row: any) => ReactNode;
}

/** Bảng CRUD dùng chung cho nhiều thực thể (Brand, CPU/GPU Benchmark, Laptop). Có tìm kiếm
 * (lọc client-side), xuất/nhập Excel, form dạng lưới 2 cột. */
export function CrudTable({
  title,
  endpoint,
  listEndpoint,
  fields,
  transformSubmit,
  transformEdit,
  renderFormExtra,
  afterSave,
}: {
  title: string;
  /** Đường dẫn gốc cho POST/PUT/DELETE, vd "/brands" (không kèm query string). */
  endpoint: string;
  /** Đường dẫn riêng cho GET danh sách, vd "/laptops?pageSize=500". Mặc định = endpoint. */
  listEndpoint?: string;
  fields: CrudField[];
  transformSubmit?: (values: any) => any;
  /** Chuyển bản ghi trước khi đổ vào form Sửa (vd ghép resWidth/resHeight thành một mục chọn). */
  transformEdit?: (row: any) => any;
  /** Nội dung phụ trong modal (vd ô AI gợi ý phân khúc). `isEdit` cho biết đang SỬA hay THÊM MỚI. */
  renderFormExtra?: (form: any, isEdit: boolean) => ReactNode;
  /** Gọi sau khi lưu thành công với bản ghi server trả về, để màn cụ thể hiện thông báo riêng. */
  afterSave?: (saved: any) => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Tăng mỗi lần mở modal để `renderFormExtra` được dựng lại, không giữ kết quả của lần trước.
  const [formKey, setFormKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  /** Tải lại danh sách từ API sau mỗi lần thêm/sửa/xóa/nhập Excel để bảng khớp dữ liệu server. */
  function load() {
    setLoading(true);
    api
      .get(listEndpoint ?? endpoint)
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được danh sách. Kiểm tra mạng và thử lại.'))
      .finally(() => setLoading(false));
  }

  // Tải lại khi endpoint đổi (cùng một CrudTable dùng cho thực thể khác), không chỉ lúc mount
  useEffect(load, [endpoint, listEndpoint]);

  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return rows;
    const q = searchText.trim().toLowerCase();
    return rows.filter((row) =>
      fields.some((f) => {
        if (f.tableValue) {
          const v = f.tableValue(row);
          if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
        }
        const raw = row[f.key];
        // Trường 'select' so theo nhãn hiển thị chứ không phải ID, vì người dùng gõ tên
        const display = f.type === 'select' ? f.options?.find((o) => o.value === raw)?.label ?? raw : raw;
        return String(display ?? '').toLowerCase().includes(q);
      })
    );
  }, [rows, searchText, fields]);

  /** Mở modal chế độ THÊM MỚI: `editing = null` để `handleSubmit` gọi POST, và xóa trắng form. */
  function openCreate() {
    setEditing(null);
    form.resetFields();
    setFormKey((k) => k + 1);
    setModalOpen(true);
  }

  /** Mở modal chế độ SỬA: đổ dữ liệu dòng đang chọn vào form (qua `transformEdit` nếu có, vd ghép
   * resWidth/resHeight thành ô "Độ phân giải"). */
  function openEdit(row: any) {
    setEditing(row);
    form.setFieldsValue(transformEdit ? transformEdit(row) : row);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  }

  /** Lưu form cho cả THÊM MỚI và SỬA (phân biệt bằng `editing`). `transformSubmit` làm ngược lại
   * `transformEdit`: đưa giá trị form về đúng định dạng API. */
  async function handleSubmit() {
    const values = await form.validateFields(); // ném lỗi nếu còn trường bắt buộc trống, AntD tự hiện lỗi
    const payload = transformSubmit ? transformSubmit(values) : values;
    try {
      const r = editing
        ? await api.put(`${endpoint}/${editing.id}`, payload)
        : await api.post(endpoint, payload);
      message.success(editing ? 'Đã cập nhật.' : 'Đã thêm mới.');
      afterSave?.(r.data.data);
      setModalOpen(false);
      load(); // tải lại để bảng hiện đúng dữ liệu vừa lưu
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

  /** Chuyển giá trị thô (vd `gpuId = 14`, `srgb100 = true`) thành dạng dễ đọc trong file Excel xuất. */
  function exportLabel(f: CrudField, value: any) {
    if (f.type === 'boolean') return value ? 1 : 0;
    if (f.type === 'select') return f.options?.find((o) => o.value === value)?.label ?? value;
    return value;
  }

  /** Xuất dữ liệu đang lọc (filteredRows) ra file .xlsx 1 sheet; tên sheet cắt còn 31 ký tự do
   * giới hạn của Excel. */
  function handleExport() {
    const exportFields = fields.filter((f) => !f.hideInTable || f.key === 'id');
    const data = filteredRows.map((row) =>
      Object.fromEntries(
        exportFields.map((f) => {
          // Có tableValue dạng chuỗi thì xuất chuỗi đó, vì row[f.key] có thể không tồn tại
          const shown = f.tableValue?.(row);
          return [f.label, typeof shown === 'string' ? shown : exportLabel(f, row[f.key])];
        })
      )
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  }

  /** Nhập hàng loạt từ Excel/CSV: tên cột phải đúng `field.label` (khớp file xuất). Mỗi dòng gọi
   * POST riêng, phù hợp quy mô vài trăm dòng. */
  async function handleImport(file: File) {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      // Nhập mọi cột đã xuất trừ ID; không lọc theo hideInForm vì resWidth/resHeight ẩn khỏi form
      // nhưng vẫn cần cho dòng nhập.
      const importFields = fields.filter((f) => f.key !== 'id');

      let success = 0;
      let failed = 0;
      for (const jsonRow of jsonRows) {
        const payload: Record<string, any> = {};
        for (const f of importFields) {
          const raw = jsonRow[f.label];
          if (raw === undefined || raw === '') continue;
          if (f.type === 'boolean') payload[f.key] = raw === 1 || raw === true || raw === 'Có';
          else if (f.type === 'select') {
            // File xuất ghi nhãn hiển thị chứ không phải ID nên tra ngược nhãn -> giá trị; vẫn chấp
            // nhận file ghi sẵn giá trị (ID hoặc mã phân khúc).
            const opt = f.options?.find((o) => o.label === String(raw) || String(o.value) === String(raw));
            if (opt) payload[f.key] = opt.value;
          } else if (f.type === 'number') payload[f.key] = Number(raw);
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
    return false; // chặn Upload tự upload lên server
  }

  // Cột bảng tự sinh từ `fields`: thêm trường mới vào `fields` là đủ, không cần sửa ở đây
  const columns = [
    ...fields
      .filter((f) => !f.hideInTable)
      .map((f) => ({
        title: f.label,
        dataIndex: f.key,
        key: f.key,
        // boolean -> "Có"/"Không"; select -> nhãn hiển thị từ ID; còn lại hiện nguyên giá trị
        render: (v: any, row: any) =>
          f.tableValue
            ? f.tableValue(row)
            : f.type === 'boolean'
              ? (v ? 'Có' : 'Không')
              : f.thousands
                ? formatNumber(v, 0)
                : f.type === 'select'
                ? (f.options?.find((o) => o.value === v)?.label ?? v)
                : v,
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
  // Form nhiều trường (vd Laptop) hiện lưới 2 cột cho gọn; form ít trường giữ 1 cột
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
        <div style={{ marginBottom: 8, color: t.textSecondary, fontSize: 13 }}>
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
        centered
        // Form dài: thân popup tự cuộn, tiêu đề và nút Lưu/Hủy luôn hiện
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 8 } }}
        // Không đóng khi bấm ra ngoài để tránh mất dữ liệu đang nhập
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <div key={formKey}>{renderFormExtra?.(form, !!editing)}</div>
          <div
            style={
              useGrid
                ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }
                : undefined
            }
          >
            {formFields.map((f) => (
              <Form.Item
                key={f.key}
                name={f.key}
                label={f.label}
                extra={f.help}
                valuePropName={f.type === 'boolean' ? 'checked' : undefined}
                rules={[
                  ...(f.required ? [{ required: true, message: `Vui lòng nhập ${f.label}` }] : []),
                  // Chặn giá trị ngoài khoảng cho phép ngay khi bấm Lưu
                  ...(f.type === 'number' && (f.min !== undefined || f.max !== undefined)
                    ? [{ type: 'number' as const, min: f.min, max: f.max, message: `${f.label} phải trong khoảng ${f.min ?? '-∞'} – ${f.max ?? '∞'}` }]
                    : []),
                ]}
              >
                {f.type === 'number' ? (
                  <InputNumber
                    style={{ width: '100%' }}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    {...(f.thousands
                      ? {
                          formatter: (v: unknown) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
                          parser: (v: string | undefined) => Number((v ?? '').replace(/\./g, '')),
                        }
                      : {})}
                  />
                ) : f.type === 'boolean' ? (
                  <Switch />
                ) : f.type === 'select' ? (
                  <Select
                    options={f.options}
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn..."
                    allowClear={!f.required} // ô không bắt buộc (vd Phân khúc) phải xóa được để về "để trống"
                  />
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
