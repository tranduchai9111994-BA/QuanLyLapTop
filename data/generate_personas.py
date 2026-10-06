"""Sinh 30 persona kiểm thử từ catalog thật (không hard-code khoảng giá).

Mỗi persona có thêm trường `text` (câu nói tự nhiên) để kiểm thử cả Mô hình C
(TF-IDF + kNN phân loại câu tự do), không chỉ wizard dạng dropdown.

Chạy: python data/generate_personas.py (chạy sau generate_catalog.py)
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import pandas as pd

random.seed(42)
ROOT = Path(__file__).resolve().parent
catalog = pd.read_csv(ROOT / "processed" / "catalog_vn.csv")

# Khoảng giá thực tế của từng phân khúc (phân vị 15-80), để persona luôn có ứng viên phù hợp
BUDGET_BY_SEGMENT = {
    seg: (
        int(round(sub["price_vnd"].quantile(0.15) / 1e6) * 1e6),
        int(round(sub["price_vnd"].quantile(0.80) / 1e6) * 1e6),
    )
    for seg, sub in catalog.groupby("segment")
}
print("Khoảng ngân sách suy từ catalog thật:")
for seg, (lo, hi) in BUDGET_BY_SEGMENT.items():
    print(f"  {seg:10s} {lo/1e6:5.1f} - {hi/1e6:5.1f} triệu")

# (mô tả, câu tự do, segment kỳ vọng, nhãn nhu cầu kỳ vọng của Mô hình C, activities, priorities, must)
TEMPLATES = [
    ("Sinh vien nam nhat, hoc online, ngan sach thap",
     "em là sinh viên năm nhất cần laptop học online giá rẻ",
     "OFFICE", "HOC_TAP", ["hoc_tap"], {"performance": 1, "mobility": 3, "display": 2, "price": 5}, {}),
    ("Ke toan can may ben, re",
     "con học kế toán, cần máy bền, rẻ",
     "OFFICE", "VAN_PHONG", ["van_phong"], {"performance": 2, "mobility": 3, "display": 2, "price": 5}, {}),
    ("Nhan vien van phong di lai nhieu",
     "cần máy nhẹ đi công tác nhiều, pin trâu",
     "ULTRABOOK", "DI_DONG", ["van_phong", "di_chuyen_nhieu"], {"performance": 2, "mobility": 5, "display": 3, "price": 3}, {}),
    ("Freelancer thiet ke can man mau chuan",
     "mình làm thiết kế đồ họa cần laptop màn hình màu chuẩn",
     "CREATOR", "DO_HOA", ["thiet_ke", "do_hoa"], {"performance": 4, "mobility": 3, "display": 5, "price": 2}, {}),
    ("Game thu FPS tam trung",
     "cần laptop chơi game fps mượt, card rời",
     "GAMING", "GAMING", ["choi_game"], {"performance": 5, "mobility": 1, "display": 4, "price": 3}, {"gpu_dedicated": 1}),
    ("Sinh vien CNTT lap trinh + game nhe",
     "em học công nghệ thông tin cần máy code, ram 16gb",
     "GAMING", "LAP_TRINH", ["lap_trinh", "choi_game"], {"performance": 4, "mobility": 3, "display": 2, "price": 3}, {"ram_min": 16}),
    ("Nhan vien kinh doanh hay gap khach",
     "máy cho nhân viên kinh doanh đi gặp khách, mỏng nhẹ",
     "ULTRABOOK", "DI_DONG", ["van_phong", "di_chuyen_nhieu"], {"performance": 2, "mobility": 5, "display": 3, "price": 3}, {}),
    ("Kien truc su chay autocad",
     "laptop cho kiến trúc sư chạy autocad và sketchup",
     "CREATOR", "DO_HOA", ["do_hoa", "thiet_ke"], {"performance": 5, "mobility": 2, "display": 4, "price": 2}, {"ram_min": 16}),
    ("Streamer can cau hinh manh",
     "mình stream game cần máy cấu hình khủng màn 144hz",
     "GAMING", "GAMING", ["choi_game"], {"performance": 5, "mobility": 1, "display": 5, "price": 2}, {"gpu_dedicated": 1}),
    ("Giao vien mang may di day",
     "cần máy nhỏ gọn pin lâu để đi dạy",
     "ULTRABOOK", "DI_DONG", ["van_phong", "di_chuyen_nhieu"], {"performance": 2, "mobility": 5, "display": 3, "price": 4}, {}),
    ("Lap trinh vien backend ram lon",
     "mình là lập trình viên cần laptop chạy docker và máy ảo",
     "CREATOR", "LAP_TRINH", ["lap_trinh"], {"performance": 5, "mobility": 2, "display": 3, "price": 3}, {"ram_min": 32}),
    ("Nguoi dung pho thong xem phim luot web",
     "chỉ cần lướt web, xem phim, gõ văn bản thôi",
     "OFFICE", "VAN_PHONG", ["van_phong", "xem_phim"], {"performance": 1, "mobility": 3, "display": 3, "price": 5}, {}),
    ("Nhiep anh gia chinh anh",
     "máy cho nhiếp ảnh gia chỉnh ảnh lightroom, màu chính xác",
     "CREATOR", "DO_HOA", ["do_hoa"], {"performance": 4, "mobility": 3, "display": 5, "price": 2}, {"ram_min": 16}),
    ("Sinh vien y khoa doc tai lieu",
     "sinh viên y khoa cần máy đọc tài liệu và ghi chép",
     "OFFICE", "HOC_TAP", ["hoc_tap"], {"performance": 2, "mobility": 4, "display": 3, "price": 4}, {}),
    ("Ky su xay dung dung revit",
     "máy cho kỹ sư xây dựng chạy revit và render",
     "CREATOR", "DO_HOA", ["do_hoa"], {"performance": 5, "mobility": 2, "display": 4, "price": 2}, {"ram_min": 16}),
    ("Nguoi moi hoc lap trinh",
     "em cần laptop học lập trình cơ bản, tầm trung",
     "OFFICE", "LAP_TRINH", ["lap_trinh", "hoc_tap"], {"performance": 3, "mobility": 3, "display": 3, "price": 4}, {}),
    ("Content creator dung premiere",
     "em làm content cần máy dựng video youtube 4k",
     "CREATOR", "DO_HOA", ["do_hoa", "dung_video"], {"performance": 5, "mobility": 2, "display": 5, "price": 2}, {"ram_min": 16}),
    ("Nhan vien IT ho tro",
     "laptop cho nhân viên IT hỗ trợ, bền và chạy nhiều phần mềm",
     "OFFICE", "LAP_TRINH", ["lap_trinh", "van_phong"], {"performance": 3, "mobility": 3, "display": 2, "price": 4}, {}),
    ("Hoc vien cao hoc phan tich du lieu",
     "laptop để học data science chạy python, ram nhiều",
     "CREATOR", "LAP_TRINH", ["lap_trinh"], {"performance": 4, "mobility": 3, "display": 3, "price": 3}, {"ram_min": 16}),
    ("Gia dinh dung chung",
     "mua laptop cho cả nhà dùng chung, giá rẻ bền",
     "OFFICE", "VAN_PHONG", ["van_phong", "xem_phim"], {"performance": 2, "mobility": 2, "display": 3, "price": 5}, {}),
    ("Chuyen vien tai chinh excel nang",
     "mình làm kế toán cần laptop chạy excel file lớn mượt",
     "OFFICE", "VAN_PHONG", ["van_phong"], {"performance": 3, "mobility": 3, "display": 3, "price": 4}, {"ram_min": 16}),
    ("Sinh vien kien truc dung sketchup",
     "sinh viên kiến trúc cần máy dựng mô hình 3d",
     "CREATOR", "DO_HOA", ["do_hoa", "hoc_tap"], {"performance": 4, "mobility": 3, "display": 4, "price": 3}, {"ram_min": 16}),
    ("Dev mobile can may nhe pin trau",
     "cần laptop lập trình android nhẹ mang đi lại, pin lâu",
     "ULTRABOOK", "LAP_TRINH", ["lap_trinh", "di_chuyen_nhieu"], {"performance": 3, "mobility": 5, "display": 3, "price": 3}, {"ram_min": 16}),
    ("Game thu MOBA ngan sach thap",
     "máy chơi liên minh mượt, giá rẻ thôi",
     "GAMING", "GAMING", ["choi_game"], {"performance": 4, "mobility": 2, "display": 4, "price": 5}, {}),
    ("Nguoi dung cao cap hieu nang toi da",
     "cần máy cấu hình cao nhất, không quan trọng giá",
     "GAMING", "GAMING", ["choi_game", "do_hoa"], {"performance": 5, "mobility": 2, "display": 5, "price": 1}, {"gpu_dedicated": 1}),
    ("Nhan vien marketing di cong tac",
     "laptop mỏng nhẹ sang trọng đi họp với khách hàng",
     "ULTRABOOK", "DI_DONG", ["van_phong", "di_chuyen_nhieu"], {"performance": 3, "mobility": 5, "display": 4, "price": 2}, {}),
    ("Hoc sinh cap 3 hoc online",
     "mua máy cho con vào lớp 10 học online",
     "OFFICE", "HOC_TAP", ["hoc_tap"], {"performance": 1, "mobility": 3, "display": 2, "price": 5}, {}),
    ("Designer 2D in an",
     "cần máy làm đồ họa 2d và in ấn, màn đẹp",
     "CREATOR", "DO_HOA", ["thiet_ke"], {"performance": 4, "mobility": 3, "display": 5, "price": 3}, {}),
    ("Game thu the loai AAA",
     "cần máy chiến game aaa mượt ở mức cao",
     "GAMING", "GAMING", ["choi_game"], {"performance": 5, "mobility": 1, "display": 4, "price": 3}, {"gpu_dedicated": 1}),
    ("Nguoi hay lam viec o quan ca phe",
     "laptop nhẹ cho người hay làm việc ở quán cà phê, pin trâu",
     "ULTRABOOK", "DI_DONG", ["van_phong", "di_chuyen_nhieu"], {"performance": 2, "mobility": 5, "display": 3, "price": 3}, {}),
]

personas = []
for i, (mo_ta, text, seg, need_label, activities, priorities, must) in enumerate(TEMPLATES, start=1):
    lo, hi = BUDGET_BY_SEGMENT[seg]
    # Persona coi trọng giá (price cao) thì ngân sách nằm ở nửa thấp của khoảng phân khúc
    if priorities["price"] >= 5:
        budget = [lo, int(lo + 0.45 * (hi - lo))]
    elif priorities["price"] <= 2:
        budget = [int(lo + 0.35 * (hi - lo)), hi]
    else:
        budget = [lo, hi]

    expect = {
        "segment_in": [seg],
        # Nới ngân sách 10%, khớp cơ chế budget_relax của backend
        "all_price_lte": int(budget[1] * 1.1),
    }
    if must.get("ram_min"):
        expect["all_ram_gte"] = must["ram_min"]
    if must.get("gpu_dedicated"):
        expect["top1_gpu_dedicated"] = True

    personas.append({
        "id": f"P{i:02d}",
        "mo_ta": mo_ta,
        "text": text,
        "need_label_expect": need_label,
        "input": {
            "segment": None,
            "activities": activities,
            "budget": budget,
            "priorities": priorities,
            "must": must,
        },
        "expect": expect,
    })

out = ROOT / "personas" / "personas.json"
out.write_text(json.dumps(personas, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nĐã sinh {len(personas)} persona -> {out}")
