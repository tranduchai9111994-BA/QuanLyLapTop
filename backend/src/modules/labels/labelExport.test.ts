import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLabelCsv, CSV_COLUMNS, type ExportRow } from './labelExport';

const row: ExportRow = {
  segment: 'GAMING',
  updatedAt: new Date('2026-10-05T10:00:00Z'),
  laptop: {
    sku: 'ASU-00001', name: 'ASUS TUF "Gaming", 0001', series: 'TUF Gaming', ramGb: 8, ssdGb: 256,
    screenInch: 17.3, resWidth: 1920, resHeight: 1080, refreshHz: 144, srgb100: true, weightKg: 2.51,
    batteryWh: null, priceVnd: 26650000, originalPriceVnd: null, salesCount: 246, imageUrl: null, sourceUrl: null,
    brand: { name: 'ASUS', tier: 4 }, cpu: { displayName: 'Intel Core i5-12450H' },
    gpu: { displayName: 'NVIDIA GeForce RTX 4050 Laptop' },
  },
};

describe('buildLabelCsv', () => {
  it('tiêu đề trùng đúng 23 cột của catalog_vn.csv', () => {
    const catalog = readFileSync(resolve(__dirname, '../../../../data/processed/catalog_vn.csv'), 'utf-8');
    const header = catalog.replace(/^﻿/, '').split(/\r?\n/)[0];
    expect(CSV_COLUMNS.join(',')).toBe(header);
  });

  it('mỗi dòng có đủ 23 ô, số dùng dấu chấm, ô thiếu để trống, có BOM', () => {
    const csv = buildLabelCsv([row]);
    expect(csv.startsWith('﻿')).toBe(true);
    const line = csv.split('\n')[1];
    expect(line).toBe(
      'ASU-00001,ASUS,4,TUF Gaming,"ASUS TUF ""Gaming"", 0001",Intel Core i5-12450H,' +
        'NVIDIA GeForce RTX 4050 Laptop,8,256,17.3,1920x1080,144,1,2.51,,26650000,,246,,,,2026-10-05,GAMING'
    );
  });

  it('không có nhãn nào thì chỉ còn dòng tiêu đề', () => {
    expect(buildLabelCsv([]).trim().split('\n')).toHaveLength(1);
  });
});
