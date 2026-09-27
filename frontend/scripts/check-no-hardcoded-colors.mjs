#!/usr/bin/env node
/**
 * Kiem tra "cam hardcode ma mau" (docs/07_UIUX.md muc 10). Du an dung `oxlint` (khong phai
 * ESLint) lam linter chinh - oxlint la mot bo rule co dinh viet bang Rust, KHONG ho tro tu viet
 * rule tuy chinh kieu `no-restricted-syntax` cua ESLint trong doc mau, nen script Node don gian
 * nay dong vai tro tuong duong: quet moi file `.tsx` duoi `src/`, bao loi neu thay chuoi hex
 * (`#fff`, `#1A73E8`,...) NGOAI danh sach file duoc phep (noi DINH NGHIA token/ho so mau rieng).
 *
 * Chay: node scripts/check-no-hardcoded-colors.mjs (duoc goi tu `npm run lint`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..', 'src');

// Cac file duoc phep chua hex TRUC TIEP:
//  - theme/tokens.ts, theme/antdTheme.ts: chinh la NOI DINH NGHIA token, khong the "tham chieu
//    chinh no" duoc.
//  - components/smart/LaptopThumbnail.tsx: mau LOGO thuong hieu that + mau minh hoa SVG (bong,
//    khung may) - khong phai mau giao dien dung lai nhieu noi, xem ghi chu trong chinh file do.
const ALLOWLIST = new Set([
  'src/theme/tokens.ts',
  'src/theme/antdTheme.ts',
  'src/components/smart/LaptopThumbnail.tsx',
]);

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC_DIR);
const violations = [];

for (const file of files) {
  const relPath = relative(join(import.meta.dirname, '..'), file).replace(/\\/g, '/');
  if (ALLOWLIST.has(relPath)) continue;

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Bo qua dong comment (bat dau bang // sau khi trim) - vd vi du trong ghi chu giai thich.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const matches = line.match(HEX_PATTERN);
    if (matches) {
      violations.push({ file: relPath, line: i + 1, matches, text: trimmed.slice(0, 100) });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✗ Tìm thấy ${violations.length} dòng hardcode mã màu ngoài src/theme/tokens.ts:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.matches.join(', ')}]\n    ${v.text}`);
  }
  console.error('\nDùng token trong src/theme/tokens.ts thay vì hardcode hex (docs/07_UIUX.md mục 10).');
  console.error('Nếu đây là ngoại lệ hợp lý (màu thương hiệu/minh họa), thêm file vào ALLOWLIST trong script này.\n');
  process.exit(1);
} else {
  console.log(`✓ Không có mã màu hardcode ngoài token (đã quét ${files.length} file .ts/.tsx).`);
}
