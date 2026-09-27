import { prisma } from './prisma';
import { toJson } from './json';
import { logger } from './logger';

/** Ghi 1 dong vao AuditLog (UC-16) - dung cho MOI thay doi "nhay cam": cau hinh tri thuc, ghim/
 * cam may, promote/rollback mo hinh, va quan ly nguoi dung (docs/09 SS5: "Moi thay doi tri thuc,
 * promote, rollback -> AuditLog: Truy vet"). KHONG duoc phep lam hong request chinh neu ghi audit
 * that bai (vd loi ket noi CSDL tam thoi) - chi log canh bao, khong throw, vi day la du lieu
 * PHU TRO (truy vet), khong phai nghiep vu chinh.
 *
 * `entityId` luon la string (dung cho ca id so nhu userId=5 lan id chuoi nhu version mo hinh
 * "clf-2026.09.27-012747" hay key cau hinh "confidence_threshold"). */
export async function writeAudit(params: {
  userId?: number;
  action: string;
  entity: string;
  entityId?: string | number;
  detail?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId != null ? String(params.entityId) : undefined,
        detailJson: params.detail !== undefined ? toJson(params.detail) : undefined,
      },
    });
  } catch (err) {
    logger.warn('Khong ghi duoc AuditLog (bo qua, khong anh huong request chinh)', err);
  }
}
