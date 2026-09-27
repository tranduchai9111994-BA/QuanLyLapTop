import { useEffect, useState } from 'react';
import { t } from '../../theme/tokens';

/** docs/07_UIUX.md muc 8 "Dang tai ket qua": dong chu LUAN PHIEN (khong phai 1 cau tinh) trong
 * luc cho ket qua goi y - giup cam giac he thong dang "lam viec that" (so mau, tinh diem...) thay
 * vi chi 1 vong xoay vo tri. Doi cau sau moi 1,1s; dung lai o cau CUOI CUNG neu component unmount
 * som (khong quan trong vi luc do da chuyen sang hien ket qua that). */
export function LoadingMessages({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), 1100);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <div style={{ textAlign: 'center', color: t.textSecondary, fontSize: 14, marginTop: 12 }}>
      {messages[index]}
    </div>
  );
}
