import { useState } from 'react';
import { Alert, Button, Form, Progress, Space, Tag, message } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';

interface Prediction {
  label: string;
  proba: number;
  distribution: Record<string, number>;
  /** k may trong tap huan luyen gan nhat da bo phieu (FR-09) - nhan + khoang cach. */
  neighbors: { label: string; distance: number }[];
}

/** Tieu chi 3 - "he thong thong minh len": khi nhan vien nhap MAY MOI, Mo hinh A tu doc cau hinh
 * va GOI Y phan khuc kem do tin cay + danh sach k lang gieng da bo phieu. Nhan vien chi can chap
 * nhan hoac chon nhan khac o o "Phan khuc" ben duoi, roi bam Luu.
 * Viec LUU nhan do backend lam (segment.service.ts): giu nhan AI -> nguon MODEL, doi nhan khac ->
 * nguon ADMIN; bo trong o "Phan khuc" -> backend tu dung du doan, do tin cay < nguong thi vao
 * hang doi "Can xac minh". */
export function SegmentSuggester({ form }: { form: FormInstance }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  // Theo doi o "Phan khuc" dang chon gi de biet nguoi dung dang giu hay doi nhan AI goi y
  const chosenSegment = Form.useWatch('segment', form);

  async function suggest() {
    const v = form.getFieldsValue();
    // CHU Y: form CrudTable dung 1 o "resolution" gop (vd "2560x1440") khi dang THEM MOI - cac
    // truong `resWidth`/`resHeight` rieng le CHI duoc tinh ra luc bam "Luu" (xem
    // AdminLaptops.tsx transformSubmit), nen luc dang nhap (chua bam Luu) chung LUON undefined
    // trong form. Truoc day ham nay kiem tra thang `resWidth`/`resHeight` nen luon bao "thieu du
    // lieu" du da chon Do phan giai day du - phai tu tach `resolution` ra tai day, giong het cach
    // transformSubmit lam, thi moi lay dung gia tri de goi API du doan.
    let resWidth: number | undefined = v.resWidth;
    let resHeight: number | undefined = v.resHeight;
    if ((resWidth === undefined || resHeight === undefined) && v.resolution) {
      const [w, h] = String(v.resolution).split('x').map(Number);
      resWidth = w;
      resHeight = h;
    }

    const requiredBase = ['cpuId', 'gpuId', 'ramGb', 'ssdGb', 'screenInch', 'weightKg'];
    const missingBase = requiredBase.filter((k) => v[k] === undefined || v[k] === null || v[k] === '');
    const missingResolution = resWidth === undefined || resHeight === undefined || Number.isNaN(resWidth) || Number.isNaN(resHeight);
    if (missingBase.length || missingResolution) {
      message.warning('Hãy nhập đủ CPU, GPU, RAM, SSD, màn hình, độ phân giải và trọng lượng trước.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/laptops/predict-segment', {
        cpuId: v.cpuId,
        gpuId: v.gpuId,
        ramGb: v.ramGb,
        ssdGb: v.ssdGb,
        screenInch: v.screenInch,
        resWidth,
        resHeight,
        refreshHz: v.refreshHz ?? 60,
        srgb100: !!v.srgb100,
        weightKg: v.weightKg,
        batteryWh: v.batteryWh ?? 55,
      });
      const p: Prediction = r.data.data;
      setPred(p);
      // O "Phan khuc" con trong -> dien san nhan AI de nguoi dung chi can bam Luu. Neu nguoi dung
      // da tu chon roi thi KHONG ghi de - ton trong lua chon cua nguoi (co nut "Dung nhan AI").
      if (!form.getFieldValue('segment')) form.setFieldValue('segment', p.label);
    } catch (err: any) {
      // Hien dung thong bao tu server (vd "hay tai lai trang") thay vi doan bua la loi ML service
      message.error(
        err?.response?.data?.error?.message ??
          'Không gọi được mô hình. Kiểm tra dịch vụ ML có đang chạy không.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 16, padding: 12, background: t.primary50, borderRadius: 10 }}>
      <Button icon={<ExperimentOutlined />} onClick={suggest} loading={loading}>
        AI gợi ý phân khúc từ cấu hình
      </Button>

      {pred && (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 6 }}>
            Mô hình kNN dự đoán:{' '}
            <Tag color={segmentColors[pred.label]?.color}>{segmentColors[pred.label]?.label ?? pred.label}</Tag>
            <strong>{Math.round(pred.proba * 100)}%</strong>
          </div>

          {Object.entries(pred.distribution).map(([seg, p]) => (
            <div key={seg} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 130 }}>{segmentColors[seg]?.label ?? seg}</span>
              <Progress
                percent={Math.round(p * 100)}
                size="small"
                strokeColor={segmentColors[seg]?.color}
                style={{ flex: 1, margin: 0 }}
              />
            </div>
          ))}

          {/* FR-09: cho thay LY DO du doan - chinh k may gan nhat da bo phieu, khong phai hop den */}
          <div style={{ marginTop: 8, fontSize: 12, color: t.textSecondary }}>
            {pred.neighbors.length} máy gần nhất trong dữ liệu huấn luyện đã bỏ phiếu:{' '}
            {Object.entries(
              pred.neighbors.reduce<Record<string, number>>((acc, n) => {
                acc[n.label] = (acc[n.label] ?? 0) + 1;
                return acc;
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([seg, count]) => `${count} ${segmentColors[seg]?.label ?? seg}`)
              .join(', ')}
          </div>
          <Space size={4} wrap style={{ marginTop: 4 }}>
            {pred.neighbors.map((n, i) => (
              <Tag key={i} color={segmentColors[n.label]?.color} style={{ fontSize: 11, margin: 0 }}>
                #{i + 1} · khoảng cách {n.distance.toFixed(2)}
              </Tag>
            ))}
          </Space>

          {chosenSegment && chosenSegment !== pred.label && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 13, color: t.warning }}>
                Bạn đang chọn phân khúc khác với AI (sẽ lưu với nguồn "nhân viên chọn").{' '}
              </span>
              <Button size="small" onClick={() => form.setFieldValue('segment', pred.label)}>
                Dùng nhãn AI
              </Button>
            </div>
          )}

          {pred.proba < 0.6 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
              message="Hệ thống chưa chắc chắn — hãy kiểm tra lại ô Phân khúc. Nếu để trống, máy sẽ vào hàng đợi cần xác minh."
            />
          )}
        </div>
      )}
    </div>
  );
}
