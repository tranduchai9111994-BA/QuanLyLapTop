import { PrismaClient } from '@prisma/client';

// 1 INSTANCE PrismaClient DUNG CHUNG cho toan bo backend - moi module import tu day (khong tu
// `new PrismaClient()` rieng), vi moi instance giu 1 connection pool rieng toi SQL Server; tao
// nhieu instance se lang phi ket noi va co the vuot gioi han ket noi cua database.
export const prisma = new PrismaClient();
