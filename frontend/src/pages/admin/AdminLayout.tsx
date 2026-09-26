import { Layout, Menu } from 'antd';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';

const { Sider, Content } = Layout;

export function AdminLayout() {
  const location = useLocation();
  const token = localStorage.getItem('smartlap_token');
  if (!token) return <Navigate to="/admin/login" replace />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <div style={{ padding: 16, fontWeight: 700, color: '#1A73E8' }}>SmartLap · Quản trị</div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            { key: '/admin/brands', label: <Link to="/admin/brands">Hãng máy</Link> },
            { key: '/admin/benchmarks/cpu', label: <Link to="/admin/benchmarks/cpu">Benchmark CPU</Link> },
            { key: '/admin/benchmarks/gpu', label: <Link to="/admin/benchmarks/gpu">Benchmark GPU</Link> },
            { key: '/admin/laptops', label: <Link to="/admin/laptops">Laptop</Link> },
          ]}
        />
      </Sider>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
