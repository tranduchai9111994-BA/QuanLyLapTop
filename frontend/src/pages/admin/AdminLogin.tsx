import { useState } from 'react';
import { Button, Form, Input, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const r = await api.post('/auth/login', values);
      const { token, user } = r.data.data;
      if (user.role === 'CUSTOMER') {
        message.error('Tài khoản này không có quyền truy cập trang quản trị.');
        return;
      }
      localStorage.setItem('smartlap_token', token);
      localStorage.setItem('smartlap_user', JSON.stringify(user));
      navigate('/admin');
    } catch {
      message.error('Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <Card title="Đăng nhập quản trị SmartLap">
        <Form layout="vertical" onFinish={onFinish} initialValues={{ email: 'admin@smartlap.vn', password: 'Demo@123' }}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
