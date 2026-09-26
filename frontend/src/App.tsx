import { Layout, Menu } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Wizard } from './pages/Wizard';
import { Results } from './pages/Results';
import { Detail } from './pages/Detail';
import { Compare } from './pages/Compare';
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
    </Header>
  );
}

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <TopNav />
      <Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wizard" element={<Wizard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/laptop/:id" element={<Detail />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </Content>
    </Layout>
  );
}
