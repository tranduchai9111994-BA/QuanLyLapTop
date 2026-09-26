import { useState } from 'react';
import { Alert, Button, Progress, Tag, message } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';

interface Prediction {
  label: string;
  proba: number;
  distribution: Record<string, number>;
}

/** Tieu chi 3 - "he thong thong minh len": khi nhan vien nhap MAY MOI, Mo hinh A tu doc cau hinh
 * va GOI Y phan khuc kem do tin cay. Nhan vien chi can xac nhan thay vi tu phan loai bang tay.
 * Do tin cay < 60% se hien canh bao "can xac minh" (docs/07 SS7.8). */
export function SegmentSuggester({ form }: { form: FormInstance }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  async function suggest() {
    const v = form.getFieldsValue();
    const required = ['cpuId', 'gpuId', 'ramGb', 'ssdGb', 'screenInch', 'resWidth', 'resHeight', 'weightKg'];
    const missing = required.filter((k) => v[k] === undefined || v[k] === null || v[k] === '');
    if (missing.length) {
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
        resWidth: v.resWidth,
        resHeight: v.resHeight,
        refreshHz: v.refreshHz ?? 60,
        srgb100: !!v.srgb100,
        weightKg: v.weightKg,
        batteryWh: v.batteryWh ?? 55,
      });
      setPred(r.data.data);
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

          {pred.proba < 0.6 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
              message="Hệ thống chưa chắc chắn — cần nhân viên xác minh lại phân khúc."
            />
          )}
        </div>
      )}
    </div>
  );
}
