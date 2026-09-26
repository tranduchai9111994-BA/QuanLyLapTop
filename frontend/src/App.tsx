import { Layout, Menu } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Wizard } from './pages/Wizard';
import { Results } from './pages/Results';
import { Detail } from './pages/Detail';
import { Compare } from './pages/Compare';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminBrands } from './pages/admin/AdminBrands';
import { AdminCpuBenchmark, AdminGpuBenchmark } from './pages/admin/AdminBenchmarks';
import { AdminLaptops } from './pages/admin/AdminLaptops';
import { t } from './theme/tokens';

const { Header, Content } = Layout;

function TopNav() {
  const location = useLocation();
  return (
    <Header style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
      <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: t.primary700, marginRight: 32 }}>
        SmartLap
      </Link>
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        style={{ flex: 1, borderBottom: 'none' }}
        items={[
          { key: '/wizard', label: <Link to="/wizard">Tư vấn</Link> },
          { key: '/laptops', label: <Link to="/laptops">Danh mục</Link> },
        ]}
      />
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
      <Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/laptops" element={<Catalog />} />
          <Route path="/wizard" element={<Wizard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/laptop/:id" element={<Detail />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default function App() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="brands" replace />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="benchmarks/cpu" element={<AdminCpuBenchmark />} />
          <Route path="benchmarks/gpu" element={<AdminGpuBenchmark />} />
          <Route path="laptops" element={<AdminLaptops />} />
        </Route>
      </Routes>
    );
  }
  return <CustomerApp />;
}
