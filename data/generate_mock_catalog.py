"""Sinh du lieu mau (catalog VN, benchmark CPU/GPU, personas) de dung khung
truoc khi nhom thu thap du lieu that. Chay: python data/generate_mock_catalog.py
"""
import json
import random
from pathlib import Path

import pandas as pd

random.seed(42)

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
PROCESSED = ROOT / "processed"
PERSONAS = ROOT / "personas"
for d in (RAW, PROCESSED, PERSONAS):
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 1) Bang benchmark CPU / GPU (diem PassMark gia lap, xap xi thu tu thuc te)
# ---------------------------------------------------------------------------
CPU_BENCH = [
    ("i3-1215U", "Intel Core i3-1215U", 11500),
    ("i5-1235U", "Intel Core i5-1235U", 15200),
    ("i5-1240P", "Intel Core i5-1240P", 18700),
    ("i5-12500H", "Intel Core i5-12500H", 21800),
    ("i7-1255U", "Intel Core i7-1255U", 16800),
    ("i7-12700H", "Intel Core i7-12700H", 27900),
    ("i7-13700H", "Intel Core i7-13700H", 32400),
    ("i9-13900H", "Intel Core i9-13900H", 34800),
    ("i5-13420H", "Intel Core i5-13420H", 19800),
    ("ryzen-5-5500U", "AMD Ryzen 5 5500U", 15800),
    ("ryzen-5-7530U", "AMD Ryzen 5 7530U", 17600),
    ("ryzen-7-5800H", "AMD Ryzen 7 5800H", 26500),
    ("ryzen-7-7735HS", "AMD Ryzen 7 7735HS", 29800),
    ("ryzen-9-7940HS", "AMD Ryzen 9 7940HS", 35600),
    ("m1", "Apple M1", 14800),
    ("m2", "Apple M2", 16700),
    ("celeron-n4500", "Intel Celeron N4500", 4200),
    ("pentium-silver-n6000", "Intel Pentium Silver N6000", 6300),
]

GPU_BENCH = [
    ("uhd-graphics", "Intel UHD Graphics", 1100),
    ("iris-xe", "Intel Iris Xe Graphics", 2400),
    ("iris-xe-g7", "Intel Iris Xe G7", 2600),
    ("radeon-graphics-vega", "AMD Radeon Graphics (Vega)", 2100),
    ("radeon-780m", "AMD Radeon 780M", 5200),
    ("mx550", "NVIDIA GeForce MX550", 4200),
    ("rtx-3050", "NVIDIA GeForce RTX 3050 4GB", 12800),
    ("rtx-3050-ti", "NVIDIA GeForce RTX 3050 Ti", 13600),
    ("rtx-3060", "NVIDIA GeForce RTX 3060 6GB", 17900),
    ("rtx-4050", "NVIDIA GeForce RTX 4050", 18600),
    ("rtx-4060", "NVIDIA GeForce RTX 4060", 22400),
    ("rtx-4070", "NVIDIA GeForce RTX 4070", 27800),
    ("rtx-a2000", "NVIDIA RTX A2000 (Quadro)", 14200),
    ("radeon-rx-6600m", "AMD Radeon RX 6600M", 18900),
    ("apple-m1-gpu", "Apple M1 GPU 8-core", 9800),
]

cpu_rows = [
    {
        "pattern": p,
        "display_name": name,
        "raw_score": score,
        "source": "PassMark (mo phong, cho du lieu that thay the) - 2026-01-15",
    }
    for p, name, score in CPU_BENCH
]
gpu_rows = [
    {
        "pattern": p,
        "display_name": name,
        "raw_score": score,
        "source": "PassMark G3D (mo phong, cho du lieu that thay the) - 2026-01-15",
    }
    for p, name, score in GPU_BENCH
]
pd.DataFrame(cpu_rows).to_csv(PROCESSED / "cpu_benchmark.csv", index=False, encoding="utf-8-sig")
pd.DataFrame(gpu_rows).to_csv(PROCESSED / "gpu_benchmark.csv", index=False, encoding="utf-8-sig")

# ---------------------------------------------------------------------------
# 2) Catalog VN mo phong theo 4 phan khuc
# ---------------------------------------------------------------------------
BRANDS = ["ASUS", "Acer", "Dell", "HP", "Lenovo", "MSI", "LG", "Apple", "Gigabyte", "Huawei"]

SEGMENTS = {
    "OFFICE": {
        "label": "Hoc tap - Van phong",
        "cpu_pool": ["i3-1215U", "i5-1235U", "ryzen-5-5500U", "celeron-n4500", "pentium-silver-n6000", "i5-1240P"],
        "gpu_pool": ["uhd-graphics", "iris-xe", "radeon-graphics-vega"],
        "ram_pool": [8, 8, 16],
        "ssd_pool": [256, 512],
        "screen": (14.0, 15.6),
        "refresh": [60],
        "srgb100_p": 0.15,
        "weight": (1.4, 1.9),
        "battery": (42, 56),
        "price": (9_000_000, 18_000_000),
        "n": 90,
    },
    "ULTRABOOK": {
        "label": "Mong nhe - Di dong",
        "cpu_pool": ["i5-1235U", "i7-1255U", "ryzen-5-7530U", "m1", "m2", "i5-13420H"],
        "gpu_pool": ["iris-xe", "iris-xe-g7", "radeon-780m", "apple-m1-gpu"],
        "ram_pool": [16, 16, 8, 32],
        "ssd_pool": [512, 512, 1024],
        "screen": (13.3, 14.5),
        "refresh": [60, 60, 90, 120],
        "srgb100_p": 0.55,
        "weight": (1.0, 1.4),
        "battery": (50, 70),
        "price": (18_000_000, 35_000_000),
        "n": 85,
    },
    "GAMING": {
        "label": "Gaming",
        "cpu_pool": ["i5-12500H", "i7-12700H", "i7-13700H", "i9-13900H", "ryzen-7-5800H", "ryzen-7-7735HS", "ryzen-9-7940HS"],
        "gpu_pool": ["rtx-3050", "rtx-3050-ti", "rtx-3060", "rtx-4050", "rtx-4060", "rtx-4070", "radeon-rx-6600m"],
        "ram_pool": [16, 16, 32],
        "ssd_pool": [512, 512, 1024],
        "screen": (15.6, 17.3),
        "refresh": [144, 144, 165, 240],
        "srgb100_p": 0.65,
        "weight": (2.0, 2.8),
        "battery": (56, 90),
        "price": (18_000_000, 55_000_000),
        "n": 85,
    },
    "CREATOR": {
        "label": "Do hoa - Ky thuat",
        "cpu_pool": ["i7-12700H", "i7-13700H", "i9-13900H", "ryzen-9-7940HS", "m2"],
        "gpu_pool": ["rtx-3060", "rtx-4060", "rtx-4070", "rtx-a2000", "apple-m1-gpu"],
        "ram_pool": [16, 32, 32, 64],
        "ssd_pool": [512, 1024, 1024],
        "screen": (14.0, 16.0),
        "refresh": [60, 60, 90],
        "srgb100_p": 0.95,
        "weight": (1.6, 2.4),
        "battery": (60, 90),
        "price": (28_000_000, 70_000_000),
        "n": 55,
    },
}

RETAILER_CATEGORY = {
    "OFFICE": "Hoc tap - Van phong",
    "ULTRABOOK": "Mong nhe",
    "GAMING": "Laptop Gaming",
    "CREATOR": "Do hoa - Ky thuat",
}

rows = []
sku_i = 0
for segment, cfg in SEGMENTS.items():
    for i in range(cfg["n"]):
        sku_i += 1
        brand = random.choice(BRANDS)
        cpu_pattern = random.choice(cfg["cpu_pool"])
        gpu_pattern = random.choice(cfg["gpu_pool"])
        cpu_name = next(n for p, n, _ in CPU_BENCH if p == cpu_pattern)
        gpu_name = next(n for p, n, _ in GPU_BENCH if p == gpu_pattern)
        ram = random.choice(cfg["ram_pool"])
        ssd = random.choice(cfg["ssd_pool"])
        screen = round(random.uniform(*cfg["screen"]), 1)
        refresh = random.choice(cfg["refresh"])
        srgb = 1 if random.random() < cfg["srgb100_p"] else 0
        weight = round(random.uniform(*cfg["weight"]), 2)
        battery = round(random.uniform(*cfg["battery"]), 0)
        price = round(random.uniform(*cfg["price"]) / 10000) * 10000
        width = random.choice([1920, 1920, 2560, 3840, 2880])
        height = int(width * 9 / 16) if width != 2880 else 1800
        sku = f"{brand[:3].upper()}-{segment[:3]}-{sku_i:04d}"
        rows.append({
            "sku": sku,
            "brand": brand,
            "name": f"{brand} {segment.title()} {sku_i:04d}",
            "cpu_model": cpu_name,
            "gpu_model": gpu_name,
            "ram_gb": ram,
            "ssd_gb": ssd,
            "screen_inch": screen,
            "resolution": f"{width}x{height}",
            "refresh_hz": refresh,
            "srgb_100": srgb,
            "weight_kg": weight,
            "battery_wh": battery,
            "price_vnd": int(price),
            "retailer_category": RETAILER_CATEGORY[segment],
            "retailer_category_2": "",
            "image_url": "",
            "source_url": "https://example-retailer.vn/mock",
            "collected_at": "2026-01-15",
            "segment": segment,
            "label_note": "du lieu mo phong - thay bang du lieu that khi thu thap xong",
        })

df = pd.DataFrame(rows)
df_raw = df.drop(columns=["segment", "label_note"])
df_raw.to_excel(RAW / "catalog_vn_raw.xlsx", index=False)
df.to_csv(PROCESSED / "catalog_vn.csv", index=False, encoding="utf-8-sig")

print(f"Da sinh {len(df)} laptop mo phong -> data/processed/catalog_vn.csv")
print(df["segment"].value_counts())

# ---------------------------------------------------------------------------
# 3) 30 persona kiem thu
# ---------------------------------------------------------------------------
personas = [
    {
        "id": "P01", "mo_ta": "Sinh vien nam nhat, chi hoc va luot web, ngan sach thap",
        "input": {"segment": None, "activities": ["hoc_tap", "van_phong"], "budget": [9000000, 13000000],
                   "priorities": {"performance": 1, "mobility": 3, "display": 2, "price": 5}, "must": {}},
        "expect": {"segment_in": ["OFFICE"], "all_price_lte": 14300000},
    },
    {
        "id": "P02", "mo_ta": "Nhan vien van phong can may nhe di lai nhieu",
        "input": {"segment": None, "activities": ["van_phong", "di_chuyen_nhieu"], "budget": [15000000, 22000000],
                   "priorities": {"performance": 2, "mobility": 5, "display": 3, "price": 3}, "must": {}},
        "expect": {"segment_in": ["OFFICE", "ULTRABOOK"], "all_price_lte": 24200000},
    },
    {
        "id": "P03", "mo_ta": "Freelancer thiet ke can man hinh mau chuan",
        "input": {"segment": None, "activities": ["thiet_ke", "do_hoa"], "budget": [30000000, 45000000],
                   "priorities": {"performance": 4, "mobility": 3, "display": 5, "price": 2}, "must": {"srgb_100": 1}},
        "expect": {"segment_in": ["CREATOR"], "all_price_lte": 49500000},
    },
    {
        "id": "P04", "mo_ta": "Game thu FPS ngan sach tam trung",
        "input": {"segment": None, "activities": ["choi_game"], "budget": [20000000, 28000000],
                   "priorities": {"performance": 5, "mobility": 1, "display": 4, "price": 3}, "must": {"gpu_dedicated": 1}},
        "expect": {"segment_in": ["GAMING"], "all_price_lte": 30800000, "top1_gpu_dedicated": True},
    },
    {
        "id": "P05", "mo_ta": "Sinh vien CNTT lap trinh va choi game nhe",
        "input": {"segment": None, "activities": ["lap_trinh", "choi_game"], "budget": [18000000, 22000000],
                   "priorities": {"performance": 4, "mobility": 3, "display": 2, "price": 3}, "must": {"ram_min": 16}},
        "expect": {"segment_in": ["GAMING", "OFFICE"], "all_price_lte": 24200000, "all_ram_gte": 16, "top1_gpu_dedicated": True},
    },
]

segment_cycle = ["OFFICE", "ULTRABOOK", "GAMING", "CREATOR"]
ACTIVITIES_BY_SEGMENT = {
    "OFFICE": [["van_phong", "hoc_tap"], ["hoc_tap", "xem_phim"], ["van_phong", "xem_phim"]],
    "ULTRABOOK": [["van_phong", "di_chuyen_nhieu"], ["hoc_tap", "di_chuyen_nhieu"], ["lap_trinh", "di_chuyen_nhieu"]],
    "GAMING": [["choi_game", "lap_trinh"], ["choi_game", "xem_phim"], ["choi_game", "van_phong"]],
    "CREATOR": [["thiet_ke", "do_hoa"], ["do_hoa", "dung_video"], ["thiet_ke", "dung_video"]],
}
mo_ta_extra = [
    "Nhan vien ke toan can may on dinh",
    "Sinh vien thiet ke do hoa ngan sach vua",
    "Kien truc su can render 3D nhe",
    "Streamer can cau hinh manh, man hinh tan so cao",
    "Giao vien can may nhe mang di day hoc",
    "Lap trinh vien backend can RAM lon",
    "Nguoi dung pho thong xem phim luot web",
    "Nhiep anh gia chinh sua anh mau chuan",
    "Sinh vien nganh y hoc lieu tuc",
    "Nhan su marketing di cong tac nhieu",
    "Ky su xay dung dung phan mem CAD nhe",
    "Nguoi moi bat dau hoc lap trinh",
    "Content creator dung phong dung premiere",
    "Nhan vien IT ho tro can may ben",
    "Sinh vien cao hoc phan tich du lieu",
    "Nguoi dung gia dinh dung chung ca nha",
    "Chuyen vien tai chinh dung Excel nang",
    "Sinh vien kien truc dung Sketchup/3ds Max",
    "Dev mobile can may nhe pin trau",
    "Game thu MOBA ngan sach thap",
    "Nguoi dung cao cap can hieu nang toi da",
    "Nhan vien kinh doanh dung Powerpoint thuong xuyen",
    "Sinh vien ngoai ngu hoc online",
    "Chuyen gia du lieu chay model nho tren may",
    "Nguoi dung phong thu do hoa 2D",
]

for idx, extra in enumerate(mo_ta_extra, start=6):
    seg = segment_cycle[idx % 4]
    cfg = SEGMENTS[seg]
    lo, hi = cfg["price"]
    budget_lo = int(lo * 0.9 / 100000) * 100000
    budget_hi = int(hi * 1.05 / 100000) * 100000
    ram_min = random.choice([None, 8, 16])
    must = {}
    if ram_min:
        must["ram_min"] = ram_min
    if seg in ("GAMING", "CREATOR") and random.random() < 0.6:
        must["gpu_dedicated"] = 1
    personas.append({
        "id": f"P{idx:02d}",
        "mo_ta": extra,
        "input": {
            "segment": None,
            "activities": random.choice(ACTIVITIES_BY_SEGMENT[seg]),
            "budget": [budget_lo, budget_hi],
            "priorities": {
                "performance": random.randint(1, 5),
                "mobility": random.randint(1, 5),
                "display": random.randint(1, 5),
                "price": random.randint(1, 5),
            },
            "must": must,
        },
        "expect": {
            "segment_in": [seg],
            "all_price_lte": budget_hi + 2200000,
            **({"all_ram_gte": ram_min} if ram_min else {}),
            **({"top1_gpu_dedicated": True} if must.get("gpu_dedicated") else {}),
        },
    })

assert len(personas) == 30, len(personas)
(PERSONAS / "personas.json").write_text(
    json.dumps(personas, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"Da sinh {len(personas)} persona -> data/personas/personas.json")
