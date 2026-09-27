import { useEffect, useState } from 'react';
import { Drawer, Dropdown, Grid, Layout, Menu } from 'antd';
import { MenuOutlined, UserOutlined } from '@ant-design/icons';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Wizard } from './pages/Wizard';
import { Results } from './pages/Results';
import { Detail } from './pages/Detail';
import { Compare } from './pages/Compare';
import { CustomerLogin } from './pages/CustomerLogin';
import { Favorites } from './pages/Favorites';
import { History } from './pages/History';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminBrands } from './pages/admin/AdminBrands';
import { AdminCpuBenchmark, AdminGpuBenchmark } from './pages/admin/AdminBenchmarks';
import { AdminLaptops } from './pages/admin/AdminLaptops';
import { AdminPrices } from './pages/admin/AdminPrices';
import { AdminReviewQueue } from './pages/admin/AdminReviewQueue';
import { AdminModels } from './pages/admin/AdminModels';
import { AdminKnowledge } from './pages/admin/AdminKnowledge';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminFeedback } from './pages/admin/AdminFeedback';
import { AdminUsers } from './pages/admin/AdminUsers';
import { t } from './theme/tokens';

const { Header, Content } = Layout;

// File nay chia UNG DUNG lam 2 "the gioi" rieng biet dua vao duong dan URL:
//  - "/admin/*"  -> App quan tri (co menu sidebar rieng, yeu cau dang nhap STAFF/ADMIN)
//  - con lai     -> App khach hang (menu ngang don gian, ai cung xem duoc)
// Kiem tra `location.pathname.startsWith('/admin')` ngay trong component App() (thay vi long
// Route binh thuong) de mount HAN TOAN KHAC layout (khong dung chung TopNav/Menu khach hang).

/** Doc trang thai dang nhap KHACH HANG tu localStorage - dung CHUNG key voi khu quan tri
 * (`smartlap_token`/`smartlap_user`, xem AdminLogin.tsx) vi day la 1 trinh duyet chi dang nhap
 * MOT danh tinh tai 1 thoi diem (giong da so trang TMDT: hoac la nhan vien, hoac la khach hang).
 * Lang nghe su kien tuy chinh 'smartlap:customer-auth-changed' (CustomerLogin.tsx phat ra sau
 * khi dang nhap/dang ky) de menu cap nhat NGAY, khong can tai lai trang. */
function useCustomerSession() {
  const [user, setUser] = useState<{ fullName: string; role: string } | null>(() => {
    const raw = localStorage.getItem('smartlap_user');
    return raw ? JSON.parse(raw) : null;
  });
  useEffect(() => {
    function sync() {
      const raw = localStorage.getItem('smartlap_user');
      setUser(raw ? JSON.parse(raw) : null);
    }
    window.addEventListener('smartlap:customer-auth-changed', sync);
    return () => window.removeEventListener('smartlap:customer-auth-changed', sync);
  }, []);
  return user?.role === 'CUSTOMER' ? user : null;
}

/** NFR-04 (docs/02 muc 4, "responsive 375px-1920px"): tren man hinh HEP (< md ~768px), thanh
 * dieu huong NGANG (Menu + Dropdown + 2 link) tran ra ngoai man hinh - da phat hien khi kiem thu
 * Giai doan 7 o do rong 375px (chi thay logo + "Tư vấn" + nua chu "Danh", cac muc con lai bi cat
 * hoan toan khoi vung nhin). Gop toan bo dieu huong vao 1 nut "☰" mo Drawer tren man hinh hep,
 * giu nguyen thanh ngang tren man hinh rong - dung `Grid.useBreakpoint()` co san cua antd thay vi
 * tu viet listener resize rieng. */
function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const customer = useCustomerSession();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

  function logout() {
    localStorage.removeItem('smartlap_token');
    localStorage.removeItem('smartlap_user');
    window.dispatchEvent(new Event('smartlap:customer-auth-changed'));
    navigate('/');
    setDrawerOpen(false);
  }

  const navMenuItems = [
    { key: '/wizard', label: <Link to="/wizard" onClick={() => setDrawerOpen(false)}>Tư vấn</Link> },
    { key: '/laptops', label: <Link to="/laptops" onClick={() => setDrawerOpen(false)}>Danh mục</Link> },
  ];

  if (isMobile) {
    return (
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, padding: '0 16px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/logo-mark.png" alt="SmartLap" style={{ height: 32, width: 'auto' }} />
          <span style={{ fontWeight: 700, fontSize: 18, color: t.primary700 }}>SmartLap</span>
        </Link>
        <MenuOutlined style={{ fontSize: 20, color: t.textPrimary, cursor: 'pointer' }} onClick={() => setDrawerOpen(true)} />
        <Drawer title="Menu" open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="right" width={280}>
          <Menu mode="inline" selectedKeys={[location.pathname]} items={navMenuItems} style={{ marginBottom: 16, border: 'none' }} />
          {customer ? (
            <Menu
              mode="inline"
              selectedKeys={[]}
              style={{ border: 'none' }}
              items={[
                { key: 'name', label: <span style={{ color: t.textTertiary }}><UserOutlined /> {customer.fullName}</span>, disabled: true },
                { key: 'favorites', label: <Link to="/favorites" onClick={() => setDrawerOpen(false)}>Máy yêu thích</Link> },
                { key: 'history', label: <Link to="/history" onClick={() => setDrawerOpen(false)}>Lịch sử tư vấn</Link> },
                { key: 'logout', label: 'Đăng xuất', onClick: logout },
              ]}
            />
          ) : (
            <Menu
              mode="inline"
              selectedKeys={[]}
              style={{ border: 'none' }}
              items={[{ key: 'login', label: <Link to="/login" onClick={() => setDrawerOpen(false)}>Đăng nhập</Link> }]}
            />
          )}
          <Menu
            mode="inline"
            selectedKeys={[]}
            style={{ border: 'none' }}
            items={[
              {
                key: 'admin',
                label: (
                  <Link to="/admin/login" style={{ color: t.textTertiary }} onClick={() => setDrawerOpen(false)}>
                    Quản trị viên / Nhân viên
                  </Link>
                ),
              },
            ]}
          />
        </Drawer>
      </Header>
    );
  }

  return (
    <Header style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
      <Link
        to="/"
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32, textDecoration: 'none' }}
      >
        <img src="/logo-mark.png" alt="SmartLap" style={{ height: 38, width: 'auto' }} />
        <span style={{ fontWeight: 700, fontSize: 20, color: t.primary700 }}>SmartLap</span>
      </Link>
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        style={{ flex: 1, borderBottom: 'none' }}
        items={navMenuItems}
      />
      {customer ? (
        <Dropdown
          menu={{
            items: [
              { key: 'favorites', label: <Link to="/favorites">Máy yêu thích</Link> },
              { key: 'history', label: <Link to="/history">Lịch sử tư vấn</Link> },
              { type: 'divider' },
              { key: 'logout', label: 'Đăng xuất', onClick: logout },
            ],
          }}
        >
          <span style={{ cursor: 'pointer', color: t.primary700, display: 'flex', alignItems: 'center', gap: 6, marginRight: 24 }}>
            <UserOutlined /> {customer.fullName}
          </span>
        </Dropdown>
      ) : (
        <Link to="/login" style={{ color: t.primary700, fontSize: 14, fontWeight: 600, marginRight: 24 }}>
          Đăng nhập
        </Link>
      )}
      <Link to="/admin/login" style={{ color: t.textTertiary, fontSize: 13 }}>
        Quản trị viên / Nhân viên
      </Link>
    </Header>
  );
}

function CustomerApp() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <TopNav />
      {/* `minWidth: 0` la fix cho 1 loi CSS pho bien: `Layout` cua antd la flex-column, va
          flex-item mac dinh KHONG duoc phep co chieu rong nho hon noi dung "min-content" ben
          trong no (vd Segmented voi nhieu nhan dai o Catalog.tsx) - neu khong dat minWidth:0,
          1 widget con qua rong se day CA TRANG cuon ngang thay vi tu no cuon rieng trong khung
          `overflowX:auto` cua no (phat hien khi kiem thu 375px o Giai doan 7). */}
      <Content style={{ minWidth: 0 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/laptops" element={<Catalog />} />
          <Route path="/wizard" element={<Wizard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/laptop/:id" element={<Detail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Content>
    </Layout>
  );
}

/** Trang mac dinh khi vao "/admin" (chua chi ro trang con): ADMIN thay Dashboard (co day du KPI
 * + canh bao); STAFF khong co quyen xem Dashboard (backend requireRole('ADMIN')) nen dua ve
 * "Laptop" - man ho dung nhieu nhat hang ngay - tranh dieu huong toi trang roi lap tuc bao loi 403. */
function AdminIndexRedirect() {
  const userRaw = localStorage.getItem('smartlap_user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  return <Navigate to={user?.role === 'ADMIN' ? 'dashboard' : 'laptops'} replace />;
}

export default function App() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminIndexRedirect />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="benchmarks/cpu" element={<AdminCpuBenchmark />} />
          <Route path="benchmarks/gpu" element={<AdminGpuBenchmark />} />
          <Route path="laptops" element={<AdminLaptops />} />
          <Route path="prices" element={<AdminPrices />} />
          <Route path="review-queue" element={<AdminReviewQueue />} />
          <Route path="models" element={<AdminModels />} />
          <Route path="knowledge" element={<AdminKnowledge />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Routes>
    );
  }
  return <CustomerApp />;
}
