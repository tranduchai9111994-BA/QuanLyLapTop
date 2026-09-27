import { Button, Layout, Menu } from 'antd';
import { LogoutOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Content, Header } = Layout;

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('smartlap_token');
  if (!token) return <Navigate to="/admin/login" replace />;

  const userRaw = localStorage.getItem('smartlap_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  function logout() {
    localStorage.removeItem('smartlap_token');
    localStorage.removeItem('smartlap_user');
    navigate('/admin/login');
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-mark.png" alt="" style={{ height: 30, width: 'auto' }} />
          <span style={{ fontWeight: 700, color: '#1A73E8' }}>SmartLap · Quản trị</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            { key: '/admin/brands', label: <Link to="/admin/brands">Hãng máy</Link> },
            { key: '/admin/benchmarks/cpu', label: <Link to="/admin/benchmarks/cpu">Benchmark CPU</Link> },
            { key: '/admin/benchmarks/gpu', label: <Link to="/admin/benchmarks/gpu">Benchmark GPU</Link> },
            { key: '/admin/laptops', label: <Link to="/admin/laptops">Laptop</Link> },
            { key: '/admin/prices', label: <Link to="/admin/prices">Quản lý giá</Link> },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            borderBottom: '1px solid #E2EAF5',
            padding: '0 24px',
          }}
        >
          {user && <span style={{ color: '#4A5B73' }}>{user.fullName} ({user.role})</span>}
          {/* Mo tab moi de xem giao dien khach hang ma khong mat phien dang nhap quan tri */}
          <Button icon={<EyeOutlined />} onClick={() => window.open('/', '_blank')}>
            Xem như khách hàng
          </Button>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
