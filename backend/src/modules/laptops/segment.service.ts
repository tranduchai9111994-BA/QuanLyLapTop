import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { fromJson, toJson } from '../../lib/json';
import { AppError } from '../../middlewares/error';
import { logger } from '../../lib/logger';
import { SEGMENT_LABEL_VI } from '../../constants/enums';
import { computePpi } from './laptops.service';

/**
 * Gán nhãn phân khúc cho laptop (FR-09). Mỗi lần tạo/sửa laptop (kể cả nhập Excel) đều kết thúc
 * bằng 1 nhãn lưu vào SegmentLabel; snapshotSync bỏ qua laptop chưa có nhãn.
 *
 * Quy tắc:
 *  - Người dùng chọn phân khúc -> lưu đúng nhãn đó, VERIFIED; nguồn `MODEL` nếu trùng dự đoán
 *    của Mô hình A, `ADMIN` nếu khác.
 *  - Không chọn -> dùng dự đoán Mô hình A (nguồn `MODEL`): độ tin cậy >= `confidence_threshold`
 *    (mặc định 0,6) -> VERIFIED, thấp hơn -> NEEDS_REVIEW (hàng đợi "Cần xác minh").
 *  - Nhãn đã khóa (`locked`) và người dùng không chọn lại -> giữ nguyên.
 *  - ML service lỗi và không chọn -> không gán được nhãn, trả cảnh báo (vẫn lưu laptop).
 */

export const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
export type SegmentCode = (typeof SEGMENTS)[number];

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Đặc trưng đầu vào của Mô hình A (cùng bộ đặc trưng lúc huấn luyện). */
export interface SegmentFeatures {
  cpuId: number;
  gpuId: number;
  ramGb: number;
  ssdGb: number;
  screenInch: number;
  resWidth: number;
  resHeight: number;
  refreshHz?: number | null;
  srgb100?: boolean | null;
  weightKg: number;
  batteryWh?: number | null;
}

export interface SegmentPrediction {
  label: SegmentCode;
  proba: number;
  distribution: Record<string, number>;
  /** k laptop gần nhất trong tập huấn luyện đã "bỏ phiếu" cho dự đoán này. */
  neighbors: { label: string; distance: number }[];
  modelVersion: string | null;
}

/** Đọc ngưỡng tin cậy từ cấu hình tri thức, mặc định 0,6. */
async function getConfidenceThreshold(): Promise<number> {
  const row = await prisma.knowledgeConfig.findUnique({ where: { key: 'confidence_threshold' } });
  const value = fromJson<number | null>(row?.valueJson, null);
  return typeof value === 'number' ? value : DEFAULT_CONFIDENCE_THRESHOLD;
}

/** Hàm A: gọi sang ML (hàm B `predict_segment`) để lấy phân khúc dự đoán của 1 máy. */
export async function predictSegment(f: SegmentFeatures): Promise<SegmentPrediction> {
  // Form chỉ có cpuId/gpuId, ML cần ĐIỂM -> tra điểm trong bảng benchmark
  const [cpu, gpu] = await Promise.all([
    prisma.cpuBenchmark.findUnique({ where: { id: f.cpuId } }),
    prisma.gpuBenchmark.findUnique({ where: { id: f.gpuId } }),
  ]);
  // Báo lỗi rõ thay vì 500 (hay gặp khi dropdown đã cũ so với dữ liệu)
  if (!cpu || !gpu) {
    throw new AppError(
      404,
      'BENCHMARK_NOT_FOUND',
      'Không tìm thấy CPU/GPU đã chọn. Dữ liệu có thể vừa được cập nhật — hãy tải lại trang rồi chọn lại.'
    );
  }
  // ★ Gọi sang ML: đường dẫn này khớp @app.post("/predict-segment") bên main.py
  const r = await mlClient.post('/predict-segment', {
    items: [ // gói 11 đặc trưng của 1 máy
      {
        cpu_score: cpu.score,
        gpu_score: gpu.score,
        gpu_dedicated: gpu.dedicated ? 1 : 0,
        ram_gb: f.ramGb,
        ssd_gb: f.ssdGb,
        screen_inch: f.screenInch,
        ppi: computePpi(f.resWidth, f.resHeight, f.screenInch),
        refresh_hz: f.refreshHz ?? 60,
        srgb_100: f.srgb100 ? 1 : 0,
        weight_kg: f.weightKg,
        // Chưa nhập pin -> dùng 55 Wh (mức phổ biến) để không làm lệch dự đoán
        battery_wh: f.batteryWh ?? 55,
      },
    ],
  });
  const item = r.data.items[0]; // ML trả danh sách; ta chỉ gửi 1 máy nên lấy phần tử đầu
  return { // chọn các trường cần dùng để trả cho nơi gọi
    label: item.label,
    proba: item.proba,
    distribution: item.distribution,
    neighbors: item.neighbors ?? [],
    modelVersion: r.data.modelVersion ?? null,
  };
}

/**
 * Lưu nhãn phân khúc cho laptop theo quy tắc đầu file. `requested` là phân khúc người dùng chọn
 * (có thể không có). Trả về nhãn đã lưu kèm `warning` để giao diện thông báo.
 */
export async function applySegmentLabel(
  laptopId: number,
  features: SegmentFeatures,
  requested: SegmentCode | undefined,
  userId: number | undefined
) {
  const existing = await prisma.segmentLabel.findUnique({ where: { laptopId } });
  // Nhãn đã khóa và người dùng không chọn lại -> tôn trọng quyết định cũ
  if (existing?.locked && !requested) {
    return { label: existing, warning: null as string | null };
  }

  let prediction: SegmentPrediction | null = null;
  try {
    prediction = await predictSegment(features);
  } catch (err) {
    // ML service lỗi: vẫn lưu được nếu người dùng đã tự chọn phân khúc
    logger.warn(`Khong du doan duoc phan khuc cho laptop ${laptopId}`, err instanceof Error ? err.message : err);
  }

  if (!requested && !prediction) {
    return {
      label: existing,
      warning: existing
        ? 'Không gọi được mô hình AI — giữ nguyên phân khúc cũ.'
        : 'Không gọi được mô hình AI và chưa chọn phân khúc — máy sẽ CHƯA được gợi ý cho khách tới khi có phân khúc.',
    };
  }

  const threshold = await getConfidenceThreshold();
  const segment = (requested ?? prediction!.label) as SegmentCode;
  const source = requested ? (prediction && prediction.label === requested ? 'MODEL' : 'ADMIN') : 'MODEL';
  const status = requested ? 'VERIFIED' : prediction!.proba >= threshold ? 'VERIFIED' : 'NEEDS_REVIEW';

  const data = {
    segment,
    source,
    status,
    confidence: prediction?.proba ?? null,
    predictedBy: prediction?.modelVersion ?? null,
    probaJson: prediction ? toJson(prediction.distribution) : null,
    verifiedById: requested ? userId ?? null : null,
  };
  const label = await prisma.segmentLabel.upsert({
    where: { laptopId },
    create: { laptopId, ...data },
    update: data,
  });

  const warning =
    status === 'NEEDS_REVIEW'
      ? `AI chỉ tin cậy ${Math.round(prediction!.proba * 100)}% (dưới ngưỡng ${Math.round(threshold * 100)}%) — đã gán tạm "${SEGMENT_LABEL_VI[segment]}" và đưa vào hàng đợi cần xác minh.`
      : null;
  return { label, warning };
}
