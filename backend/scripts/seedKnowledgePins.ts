/**
 * Data mau cho tab "Ghim / Cấm máy" trong man Cau hinh tri thuc (AdminKnowledge.tsx, UC-13) -
 * bang nay truoc gio luon rong luc demo vi khong co quy trinh nao tu dong tao ban ghi (chi tao
 * duoc qua thao tac tay cua quan tri vien). Tao vai truong hop dien hinh: GHIM khong gioi han
 * phan khuc (khuyen mai toan catalog), GHIM rieng 1 phan khuc va co han (tai tro theo dot), CAM
 * vinh vien (loi pho bien) va CAM co han (het hang tam thoi) - dung SKU that trong catalog hien
 * co de bam vao "Xem chi tiet"/danh sach van ra dung du lieu.
 *
 * Chay: npx tsx scripts/seedKnowledgePins.ts
 */
import { prisma } from '../src/lib/prisma';

interface PinSeed {
  sku: string;
  action: 'PIN' | 'BAN';
  segment: string | null;
  reason: string;
  expiresInDays: number | null; // null = khong het han
}

const PIN_SEEDS: PinSeed[] = [
  {
    sku: 'GIG-00091',
    action: 'PIN',
    segment: null,
    reason: 'Đang chạy khuyến mãi toàn sàn tháng này, ưu tiên xuất hiện ở mọi phân khúc',
    expiresInDays: null,
  },
  {
    sku: 'ACE-00795',
    action: 'PIN',
    segment: 'GAMING',
    reason: 'Máy chủ lực dòng Gaming quý này, tồn kho cao cần đẩy bán',
    expiresInDays: null,
  },
  {
    sku: 'MAS-00185',
    action: 'PIN',
    segment: 'ULTRABOOK',
    reason: 'Đối tác tài trợ chương trình sinh viên — chỉ ưu tiên trong đợt khuyến mãi',
    expiresInDays: 30,
  },
  {
    sku: 'MAS-00251',
    action: 'BAN',
    segment: null,
    reason: 'Lỗi bàn phím phổ biến bị khách phản ánh nhiều lần, tạm ngừng gợi ý chờ xử lý',
    expiresInDays: null,
  },
  {
    sku: 'GIG-00650',
    action: 'BAN',
    segment: 'CREATOR',
    reason: 'Đang hết hàng tạm thời, dự kiến nhập lại giữa tháng sau',
    expiresInDays: 15,
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } });
  if (!admin) {
    console.error('Khong tim thay tai khoan ADMIN nao - chay `npm run seed` truoc.');
    process.exit(1);
  }

  let done = 0;
  for (const s of PIN_SEEDS) {
    const laptop = await prisma.laptop.findUnique({ where: { sku: s.sku } });
    if (!laptop) {
      console.warn(`[bo qua] Khong tim thay SKU ${s.sku} trong catalog hien tai`);
      continue;
    }
    // Tranh tao trung neu chay lai script nhieu lan: coi la trung khi cung may + cung loai
    // (PIN/BAN) da co san.
    const existing = await prisma.laptopPin.findFirst({ where: { laptopId: laptop.id, action: s.action } });
    if (existing) {
      console.log(`[bo qua] ${laptop.name} (${laptop.sku}) da co ban ghi ${s.action} tu truoc`);
      continue;
    }
    const expiresAt = s.expiresInDays != null ? new Date(Date.now() + s.expiresInDays * 24 * 60 * 60 * 1000) : null;
    await prisma.laptopPin.create({
      data: {
        laptopId: laptop.id,
        action: s.action,
        segment: s.segment,
        reason: s.reason,
        expiresAt,
        createdBy: admin.id,
      },
    });
    const label = s.action === 'PIN' ? 'Ghim' : 'Cấm';
    console.log(`[ok] ${label} ${laptop.name} (${laptop.sku})${s.segment ? ` - ${s.segment}` : ' - mọi phân khúc'}`);
    done += 1;
  }
  console.log(`\nDa tao ${done}/${PIN_SEEDS.length} ban ghi ghim/cam moi.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
