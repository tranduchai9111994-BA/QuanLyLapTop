import { useState } from 'react';
import { Alert, Button, Form, Space, Tag, message } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { ConfidenceIndicator } from '../smart/ConfidenceIndicator';

interface Prediction {
  label: string;
  proba: number;
  distribution: Record<string, number>;
  /** k máy gần nhất trong tập huấn luyện đã bỏ phiếu (FR-09): nhãn + khoảng cách. */
  neighbors: { label: string; distance: number }[];
}

/** Khi nhập máy mới, Mô hình A đọc cấu hình và gợi ý phân khúc kèm độ tin cậy + k láng giềng đã
 * bỏ phiếu. Việc lưu nhãn do backend làm (segment.service.ts): giữ nhãn AI -> nguồn MODEL, đổi
 * nhãn -> nguồn ADMIN; để trống thì backend tự dùng dự đoán, dưới ngưỡng tin cậy thì vào hàng
 * đợi "Cần xác minh". */
export function SegmentSuggester({ form }: { form: FormInstance }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  // Theo dõi ô "Phân khúc" để biết người dùng giữ hay đổi nhãn AI gợi ý
  const chosenSegment = Form.useWatch('segment', form);

  async function suggest() {
    const v = form.getFieldsValue();
    // Form chỉ có ô "resolution" gộp (vd "2560x1440"); resWidth/resHeight chỉ được tính lúc bấm
    // "Lưu" (AdminLaptops.tsx transformSubmit) nên ở đây phải tự tách ra như transformSubmit.
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
      // Ô "Phân khúc" còn trống thì điền sẵn nhãn AI; nếu người dùng đã chọn thì không ghi đè.
      if (!form.getFieldValue('segment')) form.setFieldValue('segment', p.label);
    } catch (err: any) {
      // Hiện đúng thông báo từ server thay vì đoán là lỗi ML service
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
          <ConfidenceIndicator distribution={pred.distribution} />

          {/* FR-09: cho thấy lý do dự đoán (k máy gần nhất đã bỏ phiếu), không phải hộp đen */}
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
