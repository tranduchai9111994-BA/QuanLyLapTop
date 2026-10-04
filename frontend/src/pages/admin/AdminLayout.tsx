import { useEffect, useState } from 'react';
import { Badge, Button, Drawer, Grid, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  LogoutOutlined,
  EyeOutlined,
  MenuOutlined,
  DashboardOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  LaptopOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  SettingOutlined,
  CommentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { segmentColors, t } from '../../theme/tokens';

// Màu icon menu theo từng mục (lấy từ token, không hardcode)
const ICON_COLOR = {
  dashboard: t.primary500,
  brands: t.warning,
  cpu: t.chartNeed,
  gpu: t.ai500,
  laptops: segmentColors.OFFICE.color,
  prices: t.success,
  review: segmentColors.ULTRABOOK.color,
  models: segmentColors.CREATOR.color,
  knowledge: t.primary600,
  feedback: t.error,
  users: segmentColors.GAMING.color,
};

const { Sider, Content, Header } = Layout;

/** Khung sidebar dung chung cho toan bo khu quan tri (Outlet render trang con tuong ung route).
 * Tu kiem tra dang nhap ngay tai day (khong phai o tung trang con) - chua co token HOAC token
 * do la cua tai khoan KHACH HANG (dang nhap tu /login, xem App.tsx) deu chuyen huong ve
 * /admin/login LUON - vi 2 luong dang nhap dung chung 1 localStorage key, neu chi kiem tra "co
 * token hay khong" thi 1 khach hang da dang nhap tu dieu huong thang toi /admin/... se lot qua
 * duoc (thay sidebar rong, moi API con lai deu 403 tu backend - trai nghiem xau du khong ho lo
 * du lieu gi). */
export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('smartlap_token');
  const userRaw = localStorage.getItem('smartlap_user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const isAllowed = !!token && user?.role !== 'CUSTOMER';

  // QUAN TRONG: moi Hook phai goi VO DIEU KIEN, truoc bat ky return som nao (React rules-of-
  // hooks - oxlint da bat loi nay khi con dat sau `if (!token...) return <Navigate/>` ben duoi:
  // neu component KHONG unmount giua 2 lan render ma chi doi tu "da dang nhap" sang "chua dang
  // nhap" - vd sau nay co doan code nao khac khong dieu huong di ngay - so luong Hook goi duoc
  // se tut dot ngot, React se nem loi "Rendered fewer hooks than expected"). Cac side-effect ben
  // trong tu kiem tra `isAllowed` de khong chay khi chua dang nhap hop le, thay vi bo qua ca
  // Hook.

  // So may dang cho xac minh (UC-10) - hien so tren menu de nhan vien biet CO viec can lam ma
  // khong phai tu vao tung man kiem tra. Chi doc 1 lan khi vao khu quan tri (khong tu lam moi
  // lien tuc) - du dung cho muc dich "nhac nho", khong can that real-time.
  const [pendingCount, setPendingCount] = useState(0);
  function reloadPendingCount() {
    if (!isAllowed) return;
    api
      .get('/labels/review-queue')
      .then((r) => setPendingCount(r.data.data.length))
      .catch(() => undefined);
  }
  useEffect(reloadPendingCount, [location.pathname, isAllowed]);
  // Man Duyet nhan phat su kien nay ngay sau khi duyet xong 1 may - cap nhat huy hieu NGAY,
  // khong doi den luc chuyen trang moi thay so giam (xem AdminReviewQueue.tsx).
  useEffect(() => {
    window.addEventListener('smartlap:review-queue-changed', reloadPendingCount);
    return () => window.removeEventListener('smartlap:review-queue-changed', reloadPendingCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NFR-04: tren man hep (< 768px), Sider 220px co dinh + noi dung se tran ngang ca trang (phat
  // hien khi kiem thu 375px o Giai doan 7). Lan dau tung dung Sider's `breakpoint` +
  // `onBreakpoint` de tu an, nhung phat hien 1 loi rieng cua antd (ban dang dung): du Sider gan
  // dung class "collapsed zero-width" va inline style width:0, o CHE DO "zero-width" nay
  // computed flex-basis/min-width/max-width cua no VAN la 220px (khong bi ghi de that su) - Sider
  // van chiem 220px trong luong flex du nhin nhu da an. Thay vi phu thuoc co che nua-tu-dong do,
  // tu quyet dinh bang `Grid.useBreakpoint()` (da dung on dinh o TopNav/Catalog) va KHONG RENDER
  // Sider luc mobile (thay bang nut "☰" + Drawer), dam bao khong con chiem cho trong flex.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // docs/07_UIUX.md muc 6.2: Sider "thu gon 72px" - luu lua chon vao localStorage de giu nguyen
  // qua lan tai lai trang (nguoi dung quen thu gon thi khong phai bam lai moi lan vao khu quan tri).
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('smartlap_admin_sider_collapsed') === '1');

  if (!isAllowed) return <Navigate to="/admin/login" replace />;

  function logout() {
    localStorage.removeItem('smartlap_token');
    localStorage.removeItem('smartlap_user');
    navigate('/admin/login');
  }

  function toggleCollapsed(next: boolean) {
    setCollapsed(next);
    localStorage.setItem('smartlap_admin_sider_collapsed', next ? '1' : '0');
  }

  // docs/07_UIUX.md muc 6.2: Sider nhom theo 4 nhom co dat ten - "Trí tuệ" mang icon ✨ de hoi
  // dong thay ngay phan thong minh cua he thong. Dung `type: 'group'` cua antd Menu (khong phai
  // component <Menu.ItemGroup> rieng - da bi loai bo trong cach dung `items` prop). Moi item co
  // icon de RENDER DUOC hop ly khi Sider thu gon con 72px (chi icon, an het chu).
  const menuItems: MenuProps['items'] = [
    // Dashboard/Mo hinh/Tri thuc/Phan hoi CHI danh cho ADMIN o phia backend (requireRole('ADMIN')
    // - khong nhan STAFF) - an luon o menu voi STAFF de tranh nhan vien bam vao roi gap loi 403.
    ...(user?.role === 'ADMIN'
      ? [
          {
            key: 'grp-overview',
            type: 'group' as const,
            label: 'Tổng quan',
            children: [{ key: '/admin/dashboard', icon: <DashboardOutlined style={{ color: ICON_COLOR.dashboard }} />, label: <Link to="/admin/dashboard">Dashboard</Link> }],
          },
        ]
      : []),
    {
      key: 'grp-data',
      type: 'group' as const,
      label: 'Dữ liệu',
      children: [
        { key: '/admin/brands', icon: <TagsOutlined style={{ color: ICON_COLOR.brands }} />, label: <Link to="/admin/brands">Hãng máy</Link> },
        { key: '/admin/benchmarks/cpu', icon: <ThunderboltOutlined style={{ color: ICON_COLOR.cpu }} />, label: <Link to="/admin/benchmarks/cpu">Benchmark CPU</Link> },
        { key: '/admin/benchmarks/gpu', icon: <BarChartOutlined style={{ color: ICON_COLOR.gpu }} />, label: <Link to="/admin/benchmarks/gpu">Benchmark GPU</Link> },
        { key: '/admin/laptops', icon: <LaptopOutlined style={{ color: ICON_COLOR.laptops }} />, label: <Link to="/admin/laptops">Laptop</Link> },
        { key: '/admin/prices', icon: <DollarOutlined style={{ color: ICON_COLOR.prices }} />, label: <Link to="/admin/prices">Quản lý giá</Link> },
        {
          key: '/admin/review-queue',
          icon: <CheckCircleOutlined style={{ color: ICON_COLOR.review }} />,
          label: (
            <Link to="/admin/review-queue">
              Duyệt nhãn{' '}
              {pendingCount > 0 && <Badge count={pendingCount} style={{ marginLeft: 4 }} />}
            </Link>
          ),
        },
      ],
    },
    ...(user?.role === 'ADMIN'
      ? [
          {
            key: 'grp-intel',
            type: 'group' as const,
            label: '✨ Trí tuệ',
            children: [
              { key: '/admin/models', icon: <ExperimentOutlined style={{ color: ICON_COLOR.models }} />, label: <Link to="/admin/models">Quản lý mô hình</Link> },
              { key: '/admin/knowledge', icon: <SettingOutlined style={{ color: ICON_COLOR.knowledge }} />, label: <Link to="/admin/knowledge">Cấu hình tri thức</Link> },
              { key: '/admin/feedback', icon: <CommentOutlined style={{ color: ICON_COLOR.feedback }} />, label: <Link to="/admin/feedback">Phân tích phản hồi</Link> },
            ],
          },
          {
            key: 'grp-system',
            type: 'group' as const,
            label: 'Hệ thống',
            children: [{ key: '/admin/users', icon: <TeamOutlined style={{ color: ICON_COLOR.users }} />, label: <Link to="/admin/users">Người dùng & nhật ký</Link> }],
          },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={240}
          collapsedWidth={72}
          collapsible
          collapsed={collapsed}
          onCollapse={toggleCollapsed}
          theme="light"
        >
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <img src="/logo-mark.png" alt="" style={{ height: 30, width: 'auto', flexShrink: 0 }} />
            {!collapsed && <span style={{ fontWeight: 700, color: t.primary500, whiteSpace: 'nowrap' }}>SmartLap · Quản trị</span>}
          </div>
          <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} />
        </Sider>
      )}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            background: t.bgSurface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            borderBottom: `1px solid ${t.border}`,
            padding: '0 16px',
            flexWrap: 'wrap',
          }}
        >
          {isMobile && (
            <MenuOutlined style={{ fontSize: 18, marginRight: 'auto', cursor: 'pointer' }} onClick={() => setDrawerOpen(true)} />
          )}
          {user && !isMobile && <span style={{ color: t.textSecondary }}>{user.fullName} ({user.role})</span>}
          {/* Mo tab moi de xem giao dien khach hang ma khong mat phien dang nhap quan tri */}
          <Button icon={<EyeOutlined />} onClick={() => window.open('/', '_blank')}>
            {isMobile ? '' : 'Xem như khách hàng'}
          </Button>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            {isMobile ? '' : 'Đăng xuất'}
          </Button>
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24, minWidth: 0 }}>
          <Outlet />
        </Content>
      </Layout>

      <Drawer title="Menu quản trị" open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left" width={260}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={() => setDrawerOpen(false)}
          style={{ border: 'none' }}
        />
      </Drawer>
    </Layout>
  );
}
