import type { ThemeConfig } from 'antd';
import { t } from './tokens';

// Cau hinh theme cho AntD ConfigProvider (xem main.tsx) - dich cac token mau/khoang cach dung
// chung o tokens.ts sang dinh dang rieng ma AntD hieu, de moi component (Button, Table, Menu,...)
// tu dong dung dung mau/font/border-radius cua SmartLap ma khong can set tay tung noi.

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: t.primary500,
    colorInfo: t.primary500,
    colorSuccess: t.success,
    colorWarning: t.warning,
    colorError: t.error,
    colorBgLayout: t.bgPage,
    colorBgContainer: t.bgSurface,
    colorBorder: t.borderStrong,
    colorBorderSecondary: t.border,
    colorText: t.textPrimary,
    colorTextSecondary: t.textSecondary,
    fontFamily: `'Be Vietnam Pro', 'Segoe UI', Roboto, Arial, sans-serif`,
    fontSize: 15,
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadow: t.shadowMd,
  },
  components: {
    Layout: { headerBg: '#FFFFFF', siderBg: '#FFFFFF', bodyBg: t.bgPage },
    Menu: { itemSelectedBg: t.primary50, itemSelectedColor: t.primary700, itemBorderRadius: 10 },
    Card: { paddingLG: 24 },
    Button: { primaryShadow: '0 4px 12px rgba(26,115,232,0.25)', fontWeight: 600 },
    Slider: { trackBg: t.primary500, handleColor: t.primary500, railBg: t.primary100 },
    Steps: { colorPrimary: t.primary500 },
    Table: { headerBg: t.bgSubtle, headerColor: t.textSecondary, rowHoverBg: t.primary50 },
    Tag: { borderRadiusSM: 999 },
  },
};
