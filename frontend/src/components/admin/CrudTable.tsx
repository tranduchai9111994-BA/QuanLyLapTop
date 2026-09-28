import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Upload, message } from 'antd';
import { UploadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';

export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface CrudField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { label: string; value: number | string }[]; // cho type = 'select'
  hideInTable?: boolean;
  hideInForm?: boolean;
  /** Gioi han cho o nhap so - chan gia tri vo ly (vd RAM am, SSD = 0) ngay tren giao dien. */
  min?: number;
  max?: number;
  step?: number;
  /** Chu thich nho duoi o nhap (vd "Chon tu bang benchmark da co"). */
  help?: string;
  /** Tu tinh gia tri hien trong BANG tu ca dong du lieu - dung khi gia tri khong nam thang o
   * `row[key]` (vd phan khuc nam trong `row.segmentLabel.segment`). Neu tra ve chuoi thi o tim
   * kiem cung tim theo chuoi nay. */
  tableValue?: (row: any) => ReactNode;
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
  transformEdit,
  renderFormExtra,
  afterSave,
}: {
  title: string;
  /** Duong dan goc dung cho POST/PUT/DELETE, vd "/brands" (khong kem query string). */
  endpoint: string;
  /** Duong dan dung rieng cho GET danh sach, vd "/laptops?pageSize=500". Mac dinh = endpoint. */
  listEndpoint?: string;
  fields: CrudField[];
  transformSubmit?: (values: any) => any;
  /** Chuyen doi ban ghi truoc khi do vao form Sua (vd ghep resWidth/resHeight thanh mot muc chon). */
  transformEdit?: (row: any) => any;
  /** Noi dung phu hien trong modal (vd o AI goi y phan khuc khi them laptop moi). `isEdit` cho
   * biet dang o che do SUA (co ban ghi cu) hay THEM MOI - vd canh bao "sua diem se anh huong moi
   * may dung linh kien nay" chi hop ly khi dang sua, khong phai luc them moi. */
  renderFormExtra?: (form: any, isEdit: boolean) => ReactNode;
  /** Goi sau khi luu thanh cong voi ban ghi server tra ve - de man cu the hien them thong bao
   * rieng (vd Laptop canh bao "AI chi tin cay 45%, da dua vao hang doi can xac minh"). */
  afterSave?: (saved: any) => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Tang moi lan mo modal -> `renderFormExtra` duoc dung lai tu dau (key doi), khong con giu ket
  // qua cu cua lan mo truoc (vd du doan AI cua may khac hien sai cho may dang sua).
  const [formKey, setFormKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  /** Tai lai danh sach tu API (goi lai sau moi lan them/sua/xoa/nhap Excel thanh cong, de bang
   * luon khop voi du lieu that tren server, khong tu suy doan cap nhat state cuc bo). */
  function load() {
    setLoading(true);
    api
      .get(listEndpoint ?? endpoint)
      .then((r) => setRows(r.data.data))
      .catch(() => message.error('Không tải được danh sách. Kiểm tra mạng và thử lại.'))
      .finally(() => setLoading(false));
  }

  // Tai lai neu component duoc dung cho MOT thuc the khac (vd chuyen tu man Brand sang man
  // Laptop - cung 1 component CrudTable nhung endpoint doi) - khong chi chay 1 lan luc mount
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
        // Truong 'select' (vd gpuId=14) phai so theo NHAN hien thi ("NVIDIA GeForce RTX 4070"),
        // khong phai so voi ID so - nguoi dung go ten may/linh kien, khong go ID.
        const display = f.type === 'select' ? f.options?.find((o) => o.value === raw)?.label ?? raw : raw;
        return String(display ?? '').toLowerCase().includes(q);
      })
    );
  }, [rows, searchText, fields]);

  /** Mo modal o che do THEM MOI: `editing = null` bao cho `handleSubmit` biet phai goi POST
   * (khong phai PUT), va xoa trang form cu (neu lan truoc dang sua do dang dang do). */
  function openCreate() {
    setEditing(null);
    form.resetFields();
    setFormKey((k) => k + 1);
    setModalOpen(true);
  }

  /** Mo modal o che do SUA: do san du lieu cua dong dang chon vao form. `transformEdit` (neu co)
   * dung de "giai nen" du lieu truoc khi hien - vd Laptop luu resWidth/resHeight rieng trong DB
   * nhung form chi co 1 o chon "Do phan giai" ghep ca 2, nen phai ghep lai truoc khi do vao form. */
  function openEdit(row: any) {
    setEditing(row);
    form.setFieldsValue(transformEdit ? transformEdit(row) : row);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  }

  /** Luu form (dung chung cho ca THEM MOI va SUA - phan biet bang `editing` co gia tri hay
   * khong). `transformSubmit` (neu co) lam nguoc lai `transformEdit`: bien gia tri form ve dung
   * dinh dang API can (vd tach "Do phan giai" da chon thanh resWidth/resHeight rieng). */
  async function handleSubmit() {
    const values = await form.validateFields(); // nem loi neu co truong bat buoc con trong -> AntD tu hien loi tren tung o
    const payload = transformSubmit ? transformSubmit(values) : values;
    try {
      const r = editing
        ? await api.put(`${endpoint}/${editing.id}`, payload)
        : await api.post(endpoint, payload);
      message.success(editing ? 'Đã cập nhật.' : 'Đã thêm mới.');
      afterSave?.(r.data.data);
      setModalOpen(false);
      load(); // tai lai danh sach de bang hien dung du lieu vua luu
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

  /** Chuyen 1 gia tri THO trong du lieu (vd `gpuId = 14`, `srgb100 = true`) thanh dang DE DOC
   * trong file Excel xuat ra (vd "NVIDIA GeForce RTX 4070", "1") - nguoi dung mo file Excel xem
   * bang mat thuong, khong phai lap trinh vien doc JSON. */
  function exportLabel(f: CrudField, value: any) {
    if (f.type === 'boolean') return value ? 1 : 0;
    if (f.type === 'select') return f.options?.find((o) => o.value === value)?.label ?? value;
    return value;
  }

  /** Xuat TOAN BO du lieu dang loc (filteredRows - neu dang go tim kiem thi chi xuat ket qua
   * dang loc, khong xuat het bang goc) ra file .xlsx, 1 sheet, ten sheet = ten man (cat con 31
   * ky tu vi Excel gioi han do dai ten sheet). */
  function handleExport() {
    const exportFields = fields.filter((f) => !f.hideInTable || f.key === 'id');
    const data = filteredRows.map((row) =>
      Object.fromEntries(
        exportFields.map((f) => {
          // Truong co tableValue dang chuoi (vd phan khuc nam long trong segmentLabel) -> xuat
          // dung chuoi dang hien tren bang, neu khong se ra o trong vi row[f.key] khong ton tai
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
      // Nhap MOI cot da xuat, tru ID (ID do database cap). Khong loc theo hideInForm nua: vd
      // Laptop an resWidth/resHeight khoi form (form dung 1 o "Do phan giai") nhung file xuat co 2
      // cot nay - bo qua chung thi dong nhap vao thieu do phan giai va bi tu choi.
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
            // File xuat ra ghi o chon bang NHAN hien thi (vd "Intel Core i9-13900H"), khong phai
            // ID - nen phai tra nguoc nhan -> gia tri. Truoc day ep thang Number(raw) nen file vua
            // xuat ra nhap lai bi NaN. Van chap nhan file ghi san gia tri (ID hoac ma phan khuc).
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
    return false; // ngan Upload tu upload len server mac dinh
  }

  // Dung TU DONG sinh cot bang tu khai bao `fields` - them 1 truong moi vao `fields` la du, KHONG
  // can sua rieng phan hien thi bang o day (tranh quen sua 1 trong 2 cho, dan den lech du lieu)
  const columns = [
    ...fields
      .filter((f) => !f.hideInTable)
      .map((f) => ({
        title: f.label,
        dataIndex: f.key,
        key: f.key,
        // boolean -> "Co"/"Khong"; select -> tra nhan hien thi tu ID (vd 14 -> "RTX 4070");
        // con lai hien nguyen gia tri tho (text/number)
        render: (v: any, row: any) =>
          f.tableValue
            ? f.tableValue(row)
            : f.type === 'boolean'
              ? (v ? 'Có' : 'Không')
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
  // Form nhieu truong (vd Laptop co ~15 truong) hien theo LUOI 2 cot cho gon, thay vi 1 cot dai
  // le xuong het man hinh; form it truong (vd Brand chi co ten+tier) van giu 1 cot cho don gian
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
        // Form nhap laptop kha dai - khong cho dong khi lo bam ra ngoai (mat het du lieu dang nhap)
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
                  // Chan gia tri ngoai khoang cho phep (vd RAM am, gia 0 dong) ngay khi bam Luu
                  ...(f.type === 'number' && (f.min !== undefined || f.max !== undefined)
                    ? [{ type: 'number' as const, min: f.min, max: f.max, message: `${f.label} phải trong khoảng ${f.min ?? '-∞'} – ${f.max ?? '∞'}` }]
                    : []),
                ]}
              >
                {f.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} min={f.min} max={f.max} step={f.step} />
                ) : f.type === 'boolean' ? (
                  <Switch />
                ) : f.type === 'select' ? (
                  <Select options={f.options} showSearch optionFilterProp="label" placeholder="Chọn..." />
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
