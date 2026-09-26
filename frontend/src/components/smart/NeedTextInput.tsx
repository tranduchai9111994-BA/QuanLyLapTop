import { useState } from 'react';
import { Button, Card, Input, Tag, Tooltip, message } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { t } from '../../theme/tokens';
import { formatVnd } from '../../utils/format';

export interface ParsedNeed {
  label: string;
  labelText: string;
  confidence: number;
  distribution: Record<string, number>;
  neighbors: { text: string; label: string; distance: number }[];
  priorities: { performance: number; mobility: number; display: number; price: number };
  brandWeight: number;
  activities: string[];
  budget: { min: number; max: number };
  budgetFromText: boolean;
  must: Record<string, number>;
  hints: string[];
}

const EXAMPLES = [
  'con học kế toán, cần máy bền, rẻ',
  'em học CNTT cần máy code, ram 16gb, tầm 20 triệu',
  'cần máy nhẹ đi công tác nhiều, pin trâu',
  'máy chơi game mượt dưới 30 triệu',
];

/** O nhap nhu cau bang CAU TU DO - duong vao "thong minh" cua he thong.
 * He thong dung TF-IDF + kNN de doc cau noi va tu suy ra ho so nhu cau, thay vi bat nguoi dung
 * tu keo tung thanh truot. Ket qua duoc hien thi minh bach (nhan + do tin cay + cau tuong tu). */
export function NeedTextInput({ onParsed }: { onParsed: (need: ParsedNeed, text: string) => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedNeed | null>(null);

  async function analyze(value?: string) {
    const input = (value ?? text).trim();
    if (input.length < 3) {
      message.warning('Bạn hãy mô tả nhu cầu dài hơn một chút.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post<{ success: boolean; data: ParsedNeed }>('/recommendations/parse-need', {
        text: input,
      });
      setParsed(r.data.data);
      onParsed(r.data.data, input);
      message.success('Đã hiểu nhu cầu của bạn, các mục bên dưới đã được điền sẵn.');
    } catch {
      message.error('Không phân tích được lúc này. Bạn có thể chọn tay ở phần bên dưới.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      style={{ marginBottom: 28, borderRadius: 16, border: `2px solid ${t.ai500}` }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <BulbOutlined style={{ color: t.ai500, fontSize: 18 }} />
        <span style={{ fontWeight: 600, fontSize: 16 }}>Mô tả nhu cầu bằng lời của bạn</span>
      </div>
      <div style={{ color: t.textSecondary, fontSize: 13, marginBottom: 12 }}>
        Cứ viết tự nhiên như đang nhờ tư vấn. Hệ thống sẽ tự hiểu và điền giúp bạn các lựa chọn bên dưới.
      </div>

      <Input.TextArea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ví dụ: "con học kế toán, cần máy bền, rẻ"'
        onPressEnter={(e) => {
          e.preventDefault();
          analyze();
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <Button type="primary" onClick={() => analyze()} loading={loading}>
          Phân tích nhu cầu
        </Button>
        <span style={{ color: t.textTertiary, fontSize: 13 }}>Hoặc thử:</span>
        {EXAMPLES.map((ex) => (
          <Tag
            key={ex}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setText(ex);
              analyze(ex);
            }}
          >
            {ex}
          </Tag>
        ))}
      </div>

      {parsed && (
        <div style={{ marginTop: 16, padding: 14, background: t.primary50, borderRadius: 12 }}>
          <div style={{ marginBottom: 8 }}>
            Hệ thống hiểu bạn cần:{' '}
            <strong style={{ color: t.primary700 }}>{parsed.labelText}</strong>{' '}
            <Tooltip title="Độ tin cậy do mô hình kNN tính trên các câu tương tự đã học">
              <Tag color={parsed.confidence >= 0.6 ? 'blue' : 'orange'}>
                {Math.round(parsed.confidence * 100)}% tin cậy
              </Tag>
            </Tooltip>
            {parsed.confidence < 0.6 && (
              <span style={{ color: t.warning, fontSize: 13 }}>
                — chưa chắc chắn, bạn kiểm tra lại các mục bên dưới giúp nhé
              </span>
            )}
          </div>

          <div style={{ fontSize: 13, color: t.textSecondary }}>
            Ngân sách: <strong>{formatVnd(parsed.budget.min)} – {formatVnd(parsed.budget.max)}</strong>{' '}
            {!parsed.budgetFromText && <span>(gợi ý theo nhu cầu, bạn có thể sửa)</span>}
          </div>

          {parsed.hints.length > 0 && (
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>Hệ thống còn nhận ra bạn:</span>
              {parsed.hints.map((h) => (
                <Tag key={h} color="blue">{h}</Tag>
              ))}
            </div>
          )}

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: t.primary700 }}>
              Vì sao hệ thống hiểu như vậy?
            </summary>
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6 }}>
              Mô hình kNN so câu của bạn với các câu đã học và thấy gần nhất với:
              <ul style={{ margin: '6px 0 0 16px' }}>
                {parsed.neighbors.slice(0, 3).map((n, i) => (
                  <li key={i}>
                    "{n.text}" — nhóm {n.label}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}
