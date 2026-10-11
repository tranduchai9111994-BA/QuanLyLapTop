import { useState } from 'react';
import { Alert, Button, Form, Space, Tag, Tooltip, message } from 'antd';
import { ExperimentOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';
import { ConfidenceIndicator } from '../smart/ConfidenceIndicator';
import { SegmentMathModal } from './SegmentMathModal';
import type { MathView, SegmentPrediction } from './SegmentMathModal';

/**
 * Nút "AI gợi ý phân khúc từ cấu hình" trong popup Thêm/Sửa Laptop (truyền vào CrudTable qua `renderFormExtra`).
 *
 * Mô hình A đọc cấu hình đang nhập và gợi ý phân khúc kèm độ tin cậy và k láng giềng đã bỏ phiếu.
 * Nút chỉ XEM TRƯỚC, không lưu gì.
 * Việc lưu nhãn do backend làm khi bấm "Lưu" (segment.service.ts, `applySegmentLabel`):
 *  - giữ nhãn AI: nguồn MODEL; đổi sang nhãn khác: nguồn ADMIN;
 *  - để trống ô Phân khúc: backend dùng dự đoán, nếu dưới ngưỡng tin cậy thì máy vào hàng đợi "Cần xác minh".
 *
 * Props: `form` là Form antd của popup, dùng để đọc thông số máy và điền sẵn ô "Phân khúc".
 */
export function SegmentSuggester({ form }: { form: FormInstance }) {
  const [pred, setPred] = useState<SegmentPrediction | null>(null); // kết quả của lần bấm gần nhất; null khi chưa bấm
  const [loading, setLoading] = useState(false); // đang chờ backend/ML trả lời
  // Cửa sổ toán học đang mở: bảng khoảng cách của láng giềng #i, hoặc bảng tổng hợp (null = đóng)
  const [mathView, setMathView] = useState<MathView | null>(null);
  // Theo dõi ô "Phân khúc" (render lại mỗi khi đổi) để biết nhân viên giữ hay đổi nhãn AI gợi ý
  const chosenSegment = Form.useWatch('segment', form);

  /** Đọc thông số trong form, gọi backend dự đoán và hiện kết quả. Không lưu máy. */
  async function suggest() {
    const v = form.getFieldsValue();
    // Form chỉ có ô "resolution" gộp (vd "2560x1440"); resWidth/resHeight chỉ được tách lúc bấm "Lưu"
    // (AdminLaptops.tsx, `transformSubmit`), nên ở đây phải tự tách giống như vậy.
    let resWidth: number | undefined = v.resWidth;
    let resHeight: number | undefined = v.resHeight;
    if ((resWidth === undefined || resHeight === undefined) && v.resolution) {
      const [w, h] = String(v.resolution).split('x').map(Number);
      resWidth = w;
      resHeight = h;
    }

    // Thiếu thông số bắt buộc thì cảnh báo và không gọi API (dự đoán từ dữ liệu thiếu không có nghĩa)
    const requiredBase = ['cpuId', 'gpuId', 'ramGb', 'ssdGb', 'screenInch', 'weightKg'];
    const missingBase = requiredBase.filter((k) => v[k] === undefined || v[k] === null || v[k] === '');
    const missingResolution = resWidth === undefined || resHeight === undefined || Number.isNaN(resWidth) || Number.isNaN(resHeight);
    if (missingBase.length || missingResolution) {
      message.warning('Hãy nhập đủ CPU, GPU, RAM, SSD, màn hình, độ phân giải và trọng lượng trước.');
      return;
    }
    setLoading(true);
    try {
      // Backend nhận mã CPU/GPU và tự tra điểm PassMark trong bảng benchmark rồi mới gọi ML
      const r = await api.post('/laptops/predict-segment', {
        cpuId: v.cpuId,
        gpuId: v.gpuId,
        ramGb: v.ramGb,
        ssdGb: v.ssdGb,
        screenInch: v.screenInch,
        resWidth,
        resHeight,
        refreshHz: v.refreshHz ?? 60, // bỏ trống thì dùng 60 Hz, khớp giá trị mặc định ở backend
        srgb100: !!v.srgb100,
        weightKg: v.weightKg,
        batteryWh: v.batteryWh ?? 55, // bỏ trống thì dùng 55 Wh (mức phổ biến), khớp backend
      });
      const p: SegmentPrediction = r.data.data;
      setPred(p);
      setMathView(null); // đóng cửa sổ toán học của kết quả cũ (nếu còn mở)
      // Ô "Phân khúc" còn trống thì điền sẵn nhãn AI; nếu nhân viên đã chọn thì không ghi đè.
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
    // Khung nền xanh nhạt gồm nút gợi ý và (sau khi bấm) phần kết quả
    <div style={{ marginBottom: 16, padding: 12, background: t.primary50, borderRadius: 10 }}>
      <Button icon={<ExperimentOutlined />} onClick={suggest} loading={loading}>
        AI gợi ý phân khúc từ cấu hình
      </Button>

      {pred && (
        <div style={{ marginTop: 10 }}>
          {/* Thanh xác suất 4 phân khúc; hiện nhãn "Cần xác minh" khi nhãn cao nhất dưới ngưỡng tin cậy */}
          <ConfidenceIndicator distribution={pred.distribution} threshold={pred.threshold} />

          {/* FR-09: cho thấy lý do dự đoán (k máy gần nhất đã bỏ phiếu), không phải hộp đen.
              Dòng dưới đếm số láng giềng theo nhãn rồi sắp giảm dần, vd "3 Đồ họa, 3 Mỏng nhẹ, 1 Văn phòng". */}
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
          {/* Mỗi láng giềng một thẻ, màu theo nhãn: thứ hạng (#1 gần nhất) và khoảng cách đã chuẩn hóa */}
          <Space size={4} wrap style={{ marginTop: 4 }}>
            {pred.neighbors.map((n, i) => (
              <Tag key={i} color={segmentColors[n.label]?.color} style={{ fontSize: 11, margin: 0 }}>
                #{i + 1} · khoảng cách {n.distance.toFixed(2)}
                {/* Icon "!": mở bảng cách tính khoảng cách của máy này (chỉ hiện khi ML trả `explain`) */}
                {pred.explain && (
                  <Tooltip title="Xem cách tính khoảng cách này">
                    <ExclamationCircleOutlined
                      role="button" // role, tabIndex và onKeyDown giúp bấm bằng bàn phím (phím Enter)
                      tabIndex={0}
                      aria-label={`Xem cách tính khoảng cách của máy #${i + 1}`}
                      style={{ marginLeft: 4, cursor: 'pointer' }}
                      onClick={() => setMathView({ type: 'neighbor', index: i })}
                      onKeyDown={(e) => e.key === 'Enter' && setMathView({ type: 'neighbor', index: i })}
                    />
                  </Tooltip>
                )}
              </Tag>
            ))}
            {/* "Chi tiết": bảng tổng hợp 5 bước (chuẩn hóa, khoảng cách tới các máy đã ghi nhớ, bỏ phiếu, đếm phiếu,
                so ngưỡng) */}
            {pred.explain && (
              <Button
                size="small"
                type="link"
                icon={<ExclamationCircleOutlined />}
                onClick={() => setMathView({ type: 'vote' })}
              >
                Chi tiết
              </Button>
            )}
          </Space>
          {/* Cửa sổ toán học dùng chung cho cả icon "!" và nút "Chi tiết"; `mathView` quyết định bảng nào đang mở.
              0.6 là ngưỡng mặc định khi backend chưa trả `threshold` */}
          {pred.explain && (
            <SegmentMathModal
              view={mathView}
              onClose={() => setMathView(null)}
              onNavigate={setMathView} // chuyển bảng ngay trong cửa sổ (bấm #i, nút Trước/Sau, Về bảng tổng hợp)
              threshold={pred.threshold ?? 0.6}
              explain={pred.explain}
              neighbors={pred.neighbors}
              distribution={pred.distribution}
              proba={pred.proba}
            />
          )}

          {/* Nhắc khi nhân viên chọn phân khúc khác với AI: khi lưu, nhãn mang nguồn ADMIN thay vì MODEL */}
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

          {/* Cảnh báo khi độ tin cậy dưới ngưỡng (lấy từ backend, mặc định 0,6): để trống ô Phân khúc thì máy vào
              hàng đợi */}
          {pred.proba < (pred.threshold ?? 0.6) && (
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
