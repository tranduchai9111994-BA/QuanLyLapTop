import { prisma } from '../../lib/prisma';
import { mlClient } from '../../lib/mlClient';
import { fromJson, toJson } from '../../lib/json';
import { AppError } from '../../middlewares/error';
import { logger } from '../../lib/logger';
import { SEGMENT_LABEL_VI } from '../../constants/enums';
import { computePpi } from './laptops.service';

/**
 * Nghiep vu GAN NHAN PHAN KHUC cho laptop (FR-09, tieu chi 3 "he thong tu phan loai may moi").
 *
 * Vi sao can file rieng: truoc day nut "AI goi y phan khuc" chi HIEN THI ket qua, khong luu nhan
 * nao ca. Ma snapshotSync.ts bo qua moi laptop chua co nhan khi dong bo sang ML service -> laptop
 * them moi tu trang quan tri KHONG BAO GIO duoc goi y. File nay dam bao MOI lan tao/sua laptop
 * (ke ca nhap Excel) deu ket thuc bang 1 nhan phan khuc duoc luu vao bang SegmentLabel.
 *
 * Quy tac quyet dinh nhan:
 *  - Nguoi dung CO chon phan khuc -> luu dung phan khuc do, trang thai VERIFIED (nguoi da quyet).
 *    Nguon nhan: `MODEL` neu trung voi du doan cua Mo hinh A (nguoi dung chap nhan goi y),
 *    `ADMIN` neu khac (nguoi dung tu chon nhan khac).
 *  - Nguoi dung KHONG chon -> dung du doan cua Mo hinh A, nguon `MODEL`. Do tin cay >= nguong
 *    (`confidence_threshold` trong cau hinh tri thuc, mac dinh 0,6) -> VERIFIED; thap hon ->
 *    NEEDS_REVIEW (vao hang doi "Can xac minh" cho nhan vien duyet lai).
 *  - Nhan dang bi KHOA (`locked`) va nguoi dung khong chon lai -> giu nguyen, khong ghi de.
 *  - ML service khong phan hoi va nguoi dung khong chon -> khong gan duoc nhan, tra ve canh bao
 *    (khong chan viec luu laptop, vi thong tin may van dung).
 */

export const SEGMENTS = ['OFFICE', 'ULTRABOOK', 'GAMING', 'CREATOR'] as const;
export type SegmentCode = (typeof SEGMENTS)[number];

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Cac thong so can de Mo hinh A du doan phan khuc (cung bo dac trung luc huan luyen). */
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
  /** k laptop trong tap huan luyen gan nhat da "bo phieu" cho du doan nay. */
  neighbors: { label: string; distance: number }[];
  modelVersion: string | null;
}

/** Doc nguong tin cay tu cau hinh tri thuc (quan tri vien chinh duoc), khong co thi dung 0,6. */
async function getConfidenceThreshold(): Promise<number> {
  const row = await prisma.knowledgeConfig.findUnique({ where: { key: 'confidence_threshold' } });
  const value = fromJson<number | null>(row?.valueJson, null);
  return typeof value === 'number' ? value : DEFAULT_CONFIDENCE_THRESHOLD;
}

/**
 * Gọi Mô hình A (ML service) dự đoán phân khúc từ cấu hình máy: tra điểm CPU/GPU trong bảng
 * benchmark, tính ppi, rồi gửi đúng 11 đặc trưng ML cần. Ném AppError nếu CPU/GPU không tồn tại;
 * lỗi mạng tới ML thì ném nguyên lỗi để nơi gọi tự quyết (route báo lỗi, applySegmentLabel bỏ qua).
 */
export async function predictSegment(f: SegmentFeatures): Promise<SegmentPrediction> {
  const [cpu, gpu] = await Promise.all([
    prisma.cpuBenchmark.findUnique({ where: { id: f.cpuId } }),
    prisma.gpuBenchmark.findUnique({ where: { id: f.gpuId } }),
  ]);
  // Báo lỗi rõ thay vì 500 chung chung: hay gặp khi trang mở từ trước lúc dữ liệu đổi (ID trong
  // dropdown đã cũ) - người dùng chỉ cần tải lại trang.
  if (!cpu || !gpu) {
    throw new AppError(
      404,
      'BENCHMARK_NOT_FOUND',
      'Không tìm thấy CPU/GPU đã chọn. Dữ liệu có thể vừa được cập nhật — hãy tải lại trang rồi chọn lại.'
    );
  }
  const r = await mlClient.post('/predict-segment', {
    items: [
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
  const item = r.data.items[0];
  return {
    label: item.label,
    proba: item.proba,
    distribution: item.distribution,
    neighbors: item.neighbors ?? [],
    modelVersion: r.data.modelVersion ?? null,
  };
}

/**
 * Luu nhan phan khuc cho 1 laptop vua tao/sua theo quy tac o dau file.
 * `requested` = phan khuc nguoi dung chon trong form (co the khong co).
 * Tra ve nhan da luu (hoac null) kem `warning` de giao dien bao cho nguoi dung biet.
 */
export async function applySegmentLabel(
  laptopId: number,
  features: SegmentFeatures,
  requested: SegmentCode | undefined,
  userId: number | undefined
) {
  const existing = await prisma.segmentLabel.findUnique({ where: { laptopId } });
  // Nhan da bi khoa va nguoi dung khong chu dong chon lai -> ton trong quyet dinh cu
  if (existing?.locked && !requested) {
    return { label: existing, warning: null as string | null };
  }

  let prediction: SegmentPrediction | null = null;
  try {
    prediction = await predictSegment(features);
  } catch (err) {
    // ML service tat/loi: van luu duoc neu nguoi dung da tu chon phan khuc
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
