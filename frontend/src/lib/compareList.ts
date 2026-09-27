import { useEffect, useState } from 'react';

// docs/07_UIUX.md muc 6.1: TopNav can hien "So sanh (N)" - nghia la danh sach so sanh phai la
// TRANG THAI DUNG CHUNG toan app (nhu gio hang), khong chi la state cuc bo cua Results.tsx nhu
// truoc day (chon o Ket qua roi sang trang khac la MAT lua chon, TopNav khong the biet ma hien).
// Luu trong localStorage + phat su kien tuy chinh de moi noi dang mo (TopNav, Results.tsx) cung
// cap nhat NGAY khi danh sach doi, giong cach lam voi 'smartlap:customer-auth-changed'.
const KEY = 'smartlap_compare_ids';
const EVENT = 'smartlap:compare-changed';
const MAX_COMPARE = 3;

export function getCompareIds(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(ids: number[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

/** Bat/tat 1 may trong danh sach so sanh (toi da 3 may cung luc, giong gio hang mini) - giu
 * nguyen HANH VI cu tung co trong Results.tsx (them roi cat CON 3 PHAN TU DAU, khong phai 3
 * phan tu MOI NHAT) de khong doi trai nghiem nguoi dung dang quen. */
export function toggleCompareId(id: number) {
  const current = getCompareIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, MAX_COMPARE);
  persist(next);
  return next;
}

export function clearCompareIds() {
  persist([]);
}

/** Hook doc danh sach so sanh HIEN TAI, tu dong render lai khi danh sach doi (kha vi tri o
 * TopNav) hoac khi 1 tab khac cung trinh duyet thay doi (su kien 'storage' chuan cua trinh
 * duyet, bat duoc thay doi tu tab khac). */
export function useCompareIds(): number[] {
  const [ids, setIds] = useState<number[]>(() => getCompareIds());
  useEffect(() => {
    const sync = () => setIds(getCompareIds());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return ids;
}
