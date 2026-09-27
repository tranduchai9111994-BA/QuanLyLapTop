import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

/** UC-07: đăng nhập/đăng ký cho KHÁCH HÀNG - dùng chung 1 API `/auth/login` với khu quản trị
 * (backend không tách API riêng theo vai trò), nhưng khác `AdminLogin.tsx` ở chỗ NGƯỢC LẠI: từ
 * chối tài khoản STAFF/ADMIN đăng nhập ở đây (họ có màn riêng `/admin/login`), tránh nhầm lẫn
 * "quản trị viên đăng nhập nhầm vào giao diện khách hàng rồi thắc mắc sao không thấy menu quản
 * trị". Đăng ký xong tự động đăng nhập luôn (backend trả token ngay), không cần xác nhận email
 * (ngoài phạm vi đồ án - xem docs/00_README.md mục giới hạn). */
export function CustomerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  function saveSessionAndGo(token: string, user: any) {
    localStorage.setItem('smartlap_token', token);
    localStorage.setItem('smartlap_user', JSON.stringify(user));
    window.dispatchEvent(new Event('smartlap:customer-auth-changed'));
    navigate(redirectTo, { replace: true });
  }

  async function onLogin(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const r = await api.post('/auth/login', values);
      const { token, user } = r.data.data;
      if (user.role !== 'CUSTOMER') {
        message.error('Tài khoản nhân viên/quản trị viên vui lòng đăng nhập tại trang Quản trị.');
        return;
      }
      message.success(`Chào mừng trở lại, ${user.fullName}!`);
      saveSessionAndGo(token, user);
    } catch {
      message.error('Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(values: { email: string; password: string; fullName: string }) {
    setLoading(true);
    try {
      const r = await api.post('/auth/register', values);
      const { token, user } = r.data.data;
      message.success(`Chào mừng ${user.fullName}! Tài khoản đã được tạo.`);
      saveSessionAndGo(token, user);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message ?? 'Không đăng ký được, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto' }}>
      <Card title="Tài khoản của tôi">
        <Tabs
          items={[
            {
              key: 'login',
              label: 'Đăng nhập',
              children: (
                <Form layout="vertical" onFinish={onLogin}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>
                    Đăng nhập
                  </Button>
                </Form>
              ),
            },
            {
              key: 'register',
              label: 'Tạo tài khoản',
              children: (
                <Form layout="vertical" onFinish={onRegister}>
                  <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Mật khẩu"
                    rules={[{ required: true, min: 6, message: 'Ít nhất 6 ký tự' }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>
                    Tạo tài khoản
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
