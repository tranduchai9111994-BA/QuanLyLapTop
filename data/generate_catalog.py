"""Sinh catalog laptop ~1000 dong CO LOGIC (thay the generate_mock_catalog.py cu).

Khac biet so voi ban cu (theo gop y cua giang vien):
1. Diem PassMark THAT (tham chieu cpubenchmark.net / videocardbenchmark.net), khong phai so bia.
2. Chi ghep CPU-GPU KHA DI tren thi truong (khong co Ryzen + Iris Xe, khong co Apple + RTX...).
3. Gia PHU THUOC cau hinh + thuong hieu + nhieu ngau nhien, khong phai random theo phan khuc.
4. Phan khuc CHONG LAN (gan nhan theo diem so co nguong mem + nhieu bien), khong tach bach tuyet doi.
5. Co them `brand_tier` (uy tin thuong hieu) de dua vao mo hinh.

Chay: python data/generate_catalog.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import numpy as np
import pandas as pd

RANDOM_STATE = 42
random.seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
PROCESSED = ROOT / "processed"
PERSONAS = ROOT / "personas"
for d in (RAW, PROCESSED, PERSONAS):
    d.mkdir(parents=True, exist_ok=True)

BENCH_SOURCE_CPU = "PassMark CPU Mark - cpubenchmark.net (tham chieu 2025-01)"
BENCH_SOURCE_GPU = "PassMark G3D Mark - videocardbenchmark.net (tham chieu 2025-01)"

# ---------------------------------------------------------------------------
# 1) CPU: diem PassMark that + phan loai dong (U/P/H) de rang buoc ghep GPU
# ---------------------------------------------------------------------------
# tier: "entry" (chip gia re), "u" (15W mong nhe), "p" (28W), "h" (45W+ hieu nang cao)
CPUS = [
    # pattern, display_name, passmark, vendor, tier, base_cost_trieu
    ("celeron-n4500", "Intel Celeron N4500", 1780, "Intel", "entry", 1.2),
    ("pentium-n6000", "Intel Pentium Silver N6000", 2600, "Intel", "entry", 1.5),
    ("i3-1215u", "Intel Core i3-1215U", 10500, "Intel", "u", 2.6),
    ("i5-1235u", "Intel Core i5-1235U", 13800, "Intel", "u", 3.6),
    ("i5-1335u", "Intel Core i5-1335U", 15300, "Intel", "u", 4.2),
    ("i7-1255u", "Intel Core i7-1255U", 14800, "Intel", "u", 4.8),
    ("i7-1355u", "Intel Core i7-1355U", 15700, "Intel", "u", 5.4),
    ("i5-1240p", "Intel Core i5-1240P", 16400, "Intel", "p", 4.6),
    ("i7-1260p", "Intel Core i7-1260P", 18200, "Intel", "p", 5.8),
    ("i5-12450h", "Intel Core i5-12450H", 17200, "Intel", "h", 4.4),
    ("i5-12500h", "Intel Core i5-12500H", 19700, "Intel", "h", 5.2),
    ("i5-13420h", "Intel Core i5-13420H", 19000, "Intel", "h", 5.0),
    ("i7-12700h", "Intel Core i7-12700H", 24500, "Intel", "h", 7.2),
    ("i7-13620h", "Intel Core i7-13620H", 23000, "Intel", "h", 6.8),
    ("i7-13700h", "Intel Core i7-13700H", 26500, "Intel", "h", 8.0),
    ("i9-13900h", "Intel Core i9-13900H", 28500, "Intel", "h", 10.5),
    ("i7-14700hx", "Intel Core i7-14700HX", 37000, "Intel", "h", 12.5),
    ("ryzen3-7320u", "AMD Ryzen 3 7320U", 9000, "AMD", "u", 2.4),
    ("ryzen5-5500u", "AMD Ryzen 5 5500U", 13000, "AMD", "u", 3.2),
    ("ryzen5-7530u", "AMD Ryzen 5 7530U", 15000, "AMD", "u", 3.9),
    ("ryzen7-7730u", "AMD Ryzen 7 7730U", 17500, "AMD", "u", 5.0),
    ("ryzen5-7535hs", "AMD Ryzen 5 7535HS", 18000, "AMD", "h", 4.6),
    ("ryzen7-5800h", "AMD Ryzen 7 5800H", 21000, "AMD", "h", 5.6),
    ("ryzen7-7735hs", "AMD Ryzen 7 7735HS", 24000, "AMD", "h", 7.0),
    ("ryzen7-7840hs", "AMD Ryzen 7 7840HS", 28000, "AMD", "h", 8.6),
    ("ryzen9-7940hs", "AMD Ryzen 9 7940HS", 29500, "AMD", "h", 10.0),
    ("apple-m1", "Apple M1", 14800, "Apple", "apple", 6.5),
    ("apple-m2", "Apple M2", 17000, "Apple", "apple", 8.0),
    ("apple-m3", "Apple M3", 19500, "Apple", "apple", 9.5),
]

# ---------------------------------------------------------------------------
# 2) GPU: diem PassMark G3D that + rang buoc vendor/tier CPU di kem
# ---------------------------------------------------------------------------
# kind: "igpu" (tich hop) / "dgpu" (roi)
# cpu_vendor: hang CPU bat buoc di kem (None = tuy)
# min_cpu_tier: dong CPU toi thieu de ghep (tranh U-series + RTX 4080)
GPUS = [
    # pattern, display_name, passmark, kind, vendor, cpu_vendor, min_cpu_tier, vram, cost_trieu
    ("uhd-jasper", "Intel UHD Graphics", 700, "igpu", "Intel", "Intel", "entry", None, 0.0),
    ("uhd-alderlake", "Intel UHD Graphics (Alder Lake)", 1500, "igpu", "Intel", "Intel", "u", None, 0.0),
    ("iris-xe", "Intel Iris Xe Graphics", 2600, "igpu", "Intel", "Intel", "u", None, 0.0),
    ("radeon-vega", "AMD Radeon Graphics (Vega)", 1800, "igpu", "AMD", "AMD", "u", None, 0.0),
    ("radeon-660m", "AMD Radeon 660M", 2400, "igpu", "AMD", "AMD", "u", None, 0.0),
    ("radeon-680m", "AMD Radeon 680M", 3400, "igpu", "AMD", "AMD", "u", None, 0.0),
    ("radeon-780m", "AMD Radeon 780M", 4300, "igpu", "AMD", "AMD", "h", None, 0.0),
    ("apple-gpu-8", "Apple GPU 8-core", 4800, "igpu", "Apple", "Apple", "apple", None, 0.0),
    ("apple-gpu-10", "Apple GPU 10-core", 6500, "igpu", "Apple", "Apple", "apple", None, 0.0),
    ("mx550", "NVIDIA GeForce MX550", 4000, "dgpu", "NVIDIA", None, "u", 2, 1.8),
    ("rtx-2050", "NVIDIA GeForce RTX 2050", 6500, "dgpu", "NVIDIA", None, "u", 4, 2.6),
    ("rtx-3050", "NVIDIA GeForce RTX 3050 Laptop", 8700, "dgpu", "NVIDIA", None, "h", 4, 3.8),
    ("rtx-3050ti", "NVIDIA GeForce RTX 3050 Ti Laptop", 10200, "dgpu", "NVIDIA", None, "h", 4, 4.6),
    ("rtx-4050", "NVIDIA GeForce RTX 4050 Laptop", 12500, "dgpu", "NVIDIA", None, "h", 6, 5.4),
    ("rtx-3060", "NVIDIA GeForce RTX 3060 Laptop", 13500, "dgpu", "NVIDIA", None, "h", 6, 6.0),
    ("rtx-4060", "NVIDIA GeForce RTX 4060 Laptop", 16500, "dgpu", "NVIDIA", None, "h", 8, 7.8),
    ("rtx-4070", "NVIDIA GeForce RTX 4070 Laptop", 19500, "dgpu", "NVIDIA", None, "h", 8, 10.5),
    ("rtx-4080", "NVIDIA GeForce RTX 4080 Laptop", 24000, "dgpu", "NVIDIA", None, "h", 12, 15.0),
    ("rtx-a2000", "NVIDIA RTX A2000 Laptop", 9500, "dgpu", "NVIDIA", None, "h", 4, 6.5),
    ("rx-6600m", "AMD Radeon RX 6600M", 13000, "dgpu", "AMD", "AMD", "h", 8, 6.2),
    ("rx-7600m", "AMD Radeon RX 7600M XT", 16000, "dgpu", "AMD", "AMD", "h", 8, 8.4),
]

TIER_ORDER = {"entry": 0, "u": 1, "p": 2, "h": 3, "apple": 3}


def gpu_compatible(cpu: tuple, gpu: tuple) -> bool:
    """Chi cho phep cac cap CPU-GPU thuc su ton tai tren thi truong."""
    _, _, _, cpu_vendor, cpu_tier, _ = cpu
    _, _, _, kind, gpu_vendor, required_cpu_vendor, min_tier, _, _ = gpu

    # Apple: chi dung GPU Apple, va GPU Apple chi di voi CPU Apple
    if cpu_vendor == "Apple":
        return gpu_vendor == "Apple"
    if gpu_vendor == "Apple":
        return False

    # iGPU phai dung hang voi CPU (Intel CPU khong the co Radeon 780M tich hop)
    if required_cpu_vendor is not None and required_cpu_vendor != cpu_vendor:
        return False

    # dGPU: khong gan card manh vao CPU tiet kiem dien
    if TIER_ORDER[cpu_tier] < TIER_ORDER[min_tier]:
        return False

    # Chip entry (Celeron/Pentium) khong bao gio di kem card roi
    if cpu_tier == "entry" and kind == "dgpu":
        return False

    return True


# ---------------------------------------------------------------------------
# 3) Thuong hieu + hang uy tin (dung cho gop y #6: brand_tier)
# ---------------------------------------------------------------------------
# brand: (ten, price_multiplier, tier 1-5 voi 5 = uy tin nhat)
BRANDS = [
    ("Apple", 1.45, 5),
    ("Dell", 1.15, 5),
    ("Lenovo", 1.05, 4),
    ("HP", 1.04, 4),
    ("ASUS", 1.00, 4),
    ("Acer", 0.90, 3),
    ("MSI", 1.02, 3),
    ("LG", 1.20, 4),
    ("Gigabyte", 0.95, 3),
    ("Huawei", 0.98, 3),
    ("Masstel", 0.78, 1),
    ("Avita", 0.80, 1),
]
BRANDS_NON_APPLE = [b for b in BRANDS if b[0] != "Apple"]

# Dong san pham theo hang (de ten may thuc te hon)
# Dong san pham theo hang VA theo kieu may - tranh sinh ra "ZenBook 17 inch co RTX 4070"
SERIES = {
    "Apple": {"thin": ["MacBook Air"], "perf": ["MacBook Pro"], "office": ["MacBook Air"]},
    "Dell": {"thin": ["XPS", "Inspiron Slim"], "perf": ["G15", "Alienware M"], "office": ["Inspiron", "Vostro", "Latitude"]},
    "Lenovo": {"thin": ["Yoga Slim", "ThinkPad X1"], "perf": ["LOQ", "Legion"], "office": ["IdeaPad Slim", "ThinkPad E"]},
    "HP": {"thin": ["Envy x360", "Spectre"], "perf": ["Victus", "Omen"], "office": ["Pavilion", "ProBook", "240 G9"]},
    "ASUS": {"thin": ["ZenBook", "VivoBook S"], "perf": ["TUF Gaming", "ROG Strix", "ProArt"], "office": ["VivoBook", "ExpertBook"]},
    "Acer": {"thin": ["Swift"], "perf": ["Nitro", "Predator Helios"], "office": ["Aspire", "TravelMate"]},
    "MSI": {"thin": ["Prestige"], "perf": ["Katana", "Raider", "Creator"], "office": ["Modern"]},
    "LG": {"thin": ["Gram"], "perf": ["Gram Pro"], "office": ["Gram"]},
    "Gigabyte": {"thin": ["Aero"], "perf": ["G5", "Aorus"], "office": ["G5"]},
    "Huawei": {"thin": ["MateBook X"], "perf": ["MateBook 16s"], "office": ["MateBook D"]},
    "Masstel": {"thin": ["Nobel"], "perf": ["Nobel"], "office": ["Nobel"]},
    "Avita": {"thin": ["Liber"], "perf": ["Pura"], "office": ["Pura"]},
}

# Kieu may -> nhom dong san pham phu hop
ARCH_SERIES_GROUP = {
    "budget_office": "office", "mainstream": "office", "thin_light": "thin",
    "gaming_entry": "perf", "gaming_high": "perf", "creator": "perf", "workstation": "perf",
}

SEGMENTS = ["OFFICE", "ULTRABOOK", "GAMING", "CREATOR"]


def pick_archetype() -> str:
    """Kieu may muon sinh - anh huong cach chon cau hinh (KHONG phai nhan phan khuc).
    Nhan phan khuc se duoc suy ra tu cau hinh o buoc sau => cho phep chong lan."""
    return random.choices(
        ["budget_office", "thin_light", "mainstream", "gaming_entry", "gaming_high", "creator", "workstation"],
        weights=[0.26, 0.15, 0.20, 0.15, 0.10, 0.09, 0.05],
    )[0]


def build_machine(idx: int) -> dict | None:
    arch = pick_archetype()

    # --- chon CPU theo archetype ---
    if arch == "budget_office":
        pool = [c for c in CPUS if c[4] in ("entry", "u") and c[2] < 15000]
    elif arch == "thin_light":
        pool = [c for c in CPUS if c[4] in ("u", "p", "apple")]
    elif arch == "mainstream":
        pool = [c for c in CPUS if c[4] in ("u", "p", "h") and 13000 <= c[2] <= 25000]
    elif arch in ("gaming_entry", "gaming_high"):
        pool = [c for c in CPUS if c[4] == "h"]
        if arch == "gaming_high":
            pool = [c for c in pool if c[2] >= 21000]
    elif arch == "creator":
        pool = [c for c in CPUS if c[4] in ("h", "apple") and c[2] >= 17000]
    else:  # workstation
        pool = [c for c in CPUS if c[4] == "h" and c[2] >= 24000]
    if not pool:
        return None
    cpu = random.choice(pool)
    cpu_pattern, cpu_name, cpu_pm, cpu_vendor, cpu_tier, cpu_cost = cpu

    # --- chon GPU hop le theo archetype ---
    valid = [g for g in GPUS if gpu_compatible(cpu, g)]
    if arch in ("budget_office", "thin_light"):
        candidates = [g for g in valid if g[3] == "igpu"] or valid
        if arch == "thin_light" and random.random() < 0.15:
            weak_dgpu = [g for g in valid if g[3] == "dgpu" and g[2] <= 6500]
            candidates = weak_dgpu or candidates
    elif arch == "mainstream":
        candidates = valid if random.random() < 0.45 else [g for g in valid if g[3] == "igpu"] or valid
    elif arch == "gaming_entry":
        candidates = [g for g in valid if g[3] == "dgpu" and 8000 <= g[2] <= 13500] or valid
    elif arch == "gaming_high":
        candidates = [g for g in valid if g[3] == "dgpu" and g[2] >= 13500] or valid
    elif arch == "creator":
        candidates = [g for g in valid if g[3] == "dgpu" and g[2] >= 8000] or valid
    else:  # workstation
        candidates = [g for g in valid if g[3] == "dgpu" and g[2] >= 9500] or valid
    if not candidates:
        return None
    gpu = random.choice(candidates)
    gpu_pattern, gpu_name, gpu_pm, gpu_kind, gpu_vendor, _, _, vram, gpu_cost = gpu

    # --- thuong hieu (Apple CPU => Apple brand va nguoc lai) ---
    if cpu_vendor == "Apple":
        brand_name, brand_mult, brand_tier = BRANDS[0]
    else:
        brand_name, brand_mult, brand_tier = random.choice(BRANDS_NON_APPLE)
        # Hang gia re (tier 1) khong ban may cau hinh cao
        if brand_tier == 1 and (cpu_pm > 16000 or gpu_kind == "dgpu"):
            brand_name, brand_mult, brand_tier = random.choice([b for b in BRANDS_NON_APPLE if b[2] >= 3])
        # Nguoc lai: hang cao cap (tier >= 4, vd LG Gram/Dell XPS) khong dung chip Celeron/Pentium
        if brand_tier >= 4 and cpu_tier == "entry":
            brand_name, brand_mult, brand_tier = random.choice([b for b in BRANDS_NON_APPLE if b[2] <= 3])
    # Ten dong san pham se duoc dat LAI sau khi co nhan phan khuc (xem assign_series_name),
    # de tranh tinh trang "MSI Prestige (dong doanh nhan) bi gan nhan Gaming".
    series = random.choice(SERIES[brand_name][ARCH_SERIES_GROUP[arch]])

    # --- RAM / SSD tuong quan voi suc manh may ---
    if cpu_pm < 11000:
        ram = random.choices([4, 8, 16], weights=[0.25, 0.65, 0.10])[0]
        ssd = random.choices([128, 256, 512], weights=[0.2, 0.55, 0.25])[0]
    elif cpu_pm < 18000:
        ram = random.choices([8, 16, 32], weights=[0.45, 0.50, 0.05])[0]
        ssd = random.choices([256, 512, 1024], weights=[0.35, 0.55, 0.10])[0]
    elif cpu_pm < 25000:
        ram = random.choices([8, 16, 32], weights=[0.20, 0.62, 0.18])[0]
        ssd = random.choices([256, 512, 1024], weights=[0.15, 0.60, 0.25])[0]
    else:
        ram = random.choices([16, 32, 64], weights=[0.50, 0.42, 0.08])[0]
        ssd = random.choices([512, 1024, 2048], weights=[0.45, 0.45, 0.10])[0]
    if arch == "creator":
        ram = max(ram, 16)
        ssd = max(ssd, 512)

    # --- man hinh ---
    if arch == "thin_light":
        screen = random.choice([13.3, 13.6, 14.0, 14.0, 14.5])
    elif arch in ("gaming_entry", "gaming_high", "workstation"):
        screen = random.choice([15.6, 15.6, 16.0, 16.1, 17.3])
    elif arch == "creator":
        screen = random.choice([14.0, 15.6, 16.0, 16.2])
    else:
        screen = random.choice([14.0, 15.6, 15.6, 15.6, 16.0])

    if arch in ("gaming_entry", "gaming_high"):
        resolution = random.choices(["1920x1080", "2560x1440"], weights=[0.72, 0.28])[0]
        refresh = random.choices([120, 144, 165, 240], weights=[0.12, 0.50, 0.26, 0.12])[0]
    elif arch in ("creator", "workstation"):
        resolution = random.choices(["1920x1200", "2560x1600", "3840x2160"], weights=[0.35, 0.45, 0.20])[0]
        refresh = random.choices([60, 90, 120, 165], weights=[0.45, 0.20, 0.25, 0.10])[0]
    elif arch == "thin_light":
        resolution = random.choices(["1920x1200", "2560x1600", "2880x1800"], weights=[0.55, 0.32, 0.13])[0]
        refresh = random.choices([60, 90, 120], weights=[0.52, 0.20, 0.28])[0]
    else:
        resolution = random.choices(["1366x768", "1920x1080", "1920x1200"], weights=[0.12, 0.76, 0.12])[0]
        refresh = random.choices([60, 120], weights=[0.85, 0.15])[0]

    w_px, h_px = (int(x) for x in resolution.split("x"))
    ppi = math.sqrt(w_px**2 + h_px**2) / screen

    # sRGB 100%: phu thuoc do phan giai + archetype (may do hoa gan nhu luon co)
    p_srgb = {
        "budget_office": 0.05, "thin_light": 0.45, "mainstream": 0.20,
        "gaming_entry": 0.45, "gaming_high": 0.75, "creator": 0.92, "workstation": 0.85,
    }[arch]
    if ppi > 200:
        p_srgb = min(0.97, p_srgb + 0.25)
    srgb100 = int(random.random() < p_srgb)

    # --- trong luong: ham cua kich thuoc man + co card roi hay khong ---
    # Hieu chinh theo thuc te: ultrabook 14" ~1.3kg, gaming 15.6" ~2.3kg, gaming 17.3" ~2.8kg
    base_weight = 0.093 * screen + (0.85 if gpu_kind == "dgpu" else 0.0)
    if gpu_pm >= 16000:
        base_weight += 0.30
    if arch == "thin_light":
        base_weight -= 0.20
    weight_kg = round(max(0.95, np.random.normal(base_weight, 0.11)), 2)

    # --- pin: may mong nhe pin lon hon tuong doi, may gaming pin to nhung nang ---
    if arch == "thin_light":
        battery = round(np.random.normal(60, 8))
    elif arch in ("gaming_entry", "gaming_high", "workstation"):
        battery = round(np.random.normal(72, 12))
    elif arch == "creator":
        battery = round(np.random.normal(70, 10))
    else:
        battery = round(np.random.normal(48, 8))
    battery = int(max(32, min(100, battery)))

    # --- GIA: ham cua cau hinh x thuong hieu x nhieu (gop y #4 cua thay) ---
    ram_cost = 0.18 * ram
    ssd_cost = 0.0022 * ssd
    screen_cost = 0.4 * (ppi / 100) ** 1.6 + (1.1 if srgb100 else 0) + 0.006 * max(0, refresh - 60)
    chassis_cost = 2.4 + 0.12 * screen
    base_cost = cpu_cost + gpu_cost + ram_cost + ssd_cost + screen_cost + chassis_cost
    noise = np.random.normal(1.0, 0.07)  # nhieu thi truong +-7%
    price = base_cost * brand_mult * max(0.85, noise) * 1.38  # 1.38 = he so ban le/VAT
    price_vnd = int(round(price * 1_000_000 / 10_000) * 10_000)
    price_vnd = max(5_500_000, price_vnd)

    # --- KHUYEN MAI + LUOT BAN: mo phong hanh vi thi truong that ---
    # ~35% may dang giam gia (5-25%), phan con lai gia niem yet = gia hien tai (khong giam)
    on_sale = random.random() < 0.35
    if on_sale:
        discount_pct = random.uniform(0.05, 0.25)
        original_price_vnd = int(round(price_vnd / (1 - discount_pct) / 10_000) * 10_000)
    else:
        original_price_vnd = None

    # Luot ban: TUONG QUAN voi do "dang tien" (value_index se tinh sau tu performance/price)
    # va brand_tier (hang uy tin ban chay hon), CONG THEM nhieu thi truong ngau nhien - khong
    # phai random thuan, de dung lam tin hieu "do pho bien" co y nghia trong xep hang.
    approx_value = (cpu_cost + gpu_cost) / max(price_vnd / 1_000_000, 1)
    base_sales = 40 + 25 * approx_value + 15 * brand_tier
    if on_sale:
        base_sales *= 1.4  # may dang giam gia thuong ban chay hon
    sales_count = int(max(0, np.random.normal(base_sales, base_sales * 0.4)))

    return {
        "sku": f"{brand_name[:3].upper()}-{idx:05d}",
        "brand": brand_name,
        "brand_tier": brand_tier,
        "name": f"{brand_name} {series} {idx:04d}",
        "cpu_model": cpu_name,
        "cpu_pattern": cpu_pattern,
        "gpu_model": gpu_name,
        "gpu_pattern": gpu_pattern,
        "ram_gb": ram,
        "ssd_gb": ssd,
        "screen_inch": screen,
        "resolution": resolution,
        "refresh_hz": refresh,
        "srgb_100": srgb100,
        "weight_kg": weight_kg,
        "battery_wh": battery,
        "price_vnd": price_vnd,
        "original_price_vnd": original_price_vnd if original_price_vnd else "",
        "sales_count": sales_count,
        "_arch": arch,
        "_cpu_pm": cpu_pm,
        "_gpu_pm": gpu_pm,
        "_gpu_kind": gpu_kind,
        "_ppi": ppi,
    }


# ---------------------------------------------------------------------------
# 4) Gan nhan phan khuc: diem so co trong so + nguong MEM => CHONG LAN tu nhien
# ---------------------------------------------------------------------------
def assign_segment(m: dict, cpu_max: int, gpu_max: int) -> str:
    cpu_n = m["_cpu_pm"] / cpu_max
    gpu_n = m["_gpu_pm"] / gpu_max
    dedicated = m["_gpu_kind"] == "dgpu"

    # Diem "thien huong" tung phan khuc (cang cao cang giong phan khuc do)
    gaming = 2.8 * gpu_n + 0.8 * cpu_n + 1.0 * (m["refresh_hz"] >= 144) + 0.6 * dedicated - 0.6 * (m["weight_kg"] < 1.6)
    creator = 1.5 * cpu_n + 1.2 * gpu_n + 1.0 * m["srgb_100"] + 0.7 * (m["_ppi"] > 190) + 0.5 * (m["ram_gb"] >= 32) - 0.6 * (m["refresh_hz"] >= 165)
    ultra = 2.2 * max(0.0, (2.10 - m["weight_kg"])) + 0.5 * (m["battery_wh"] >= 58) + 0.4 * (not dedicated) + 0.45 * (m["screen_inch"] <= 14.5)
    # Tru diem OFFICE khi may qua NHE (< 1.35kg): may nhe co gia re van thien ve ULTRABOOK
    # hon la OFFICE trong thuc te thi truong - thieu dieu nay khien 2 lop chong lan qua muc.
    office = (
        1.6 * (1 - cpu_n) + 0.7 * (not dedicated) + 0.6 * (m["price_vnd"] < 18_000_000)
        + 0.4 * (m["refresh_hz"] <= 60) + 0.3 * (not m["srgb_100"])
        - 0.9 * max(0.0, 1.35 - m["weight_kg"])
    )

    scores = {"GAMING": gaming, "CREATOR": creator, "ULTRABOOK": ultra, "OFFICE": office}

    # Nhieu gan nhan: mo phong viec nha ban le xep loai khong nhat quan (chong lan that)
    # Nhieu gan nhan da GIAM tu 0.45 -> 0.32 (thuc nghiem): 0.45 tao qua nhieu nhan "sai" so voi
    # kappa thuc te (nguoi gan nhan that thuong dong y >=70%), lam macro-F1 tut duoi nguong hop ly
    # du dac trung ky thuat van chong lan tu nhien (xem bang trong luong/gpu o tren).
    noisy = {k: v + np.random.normal(0, 0.32) for k, v in scores.items()}
    return max(noisy, key=noisy.get)


# Nhan phan khuc -> nhom dong san pham duoc phep dung. GAMING va CREATOR dung chung nhom "perf"
# (thuc te mot chiec Acer Nitro van hay duoc xep vao "Do hoa - Ky thuat"), OFFICE/ULTRABOOK dung
# nhom van phong/mong nhe. Nho vay van CHONG LAN o dac trung ky thuat nhung khong con tinh trang
# vo ly kieu "MSI Prestige (dong doanh nhan) mang nhan Gaming".
SEGMENT_SERIES_GROUP = {
    "GAMING": "perf", "CREATOR": "perf", "OFFICE": "office", "ULTRABOOK": "thin",
}


def assign_series_name(m: dict, idx: int) -> tuple[str, str]:
    """Dat lai DONG SAN PHAM (series) SAU khi da co nhan phan khuc, de ten va nhan khong mau thuan.
    Tra ve (series, ten_day_du). `series` duoc luu thanh mot COT RIENG vi gia ban gan voi tung
    dong may / model cu the, khong phai gan voi hang."""
    group = SEGMENT_SERIES_GROUP[m["segment"]]
    series = random.choice(SERIES[m["brand"]][group])
    return series, f"{m['brand']} {series} {idx:04d}"


def main() -> None:
    cpu_max = max(c[2] for c in CPUS)
    gpu_max = max(g[2] for g in GPUS)

    machines: list[dict] = []
    idx = 1
    while len(machines) < 1000:
        m = build_machine(idx)
        idx += 1
        if m is None:
            continue
        m["segment"] = assign_segment(m, cpu_max, gpu_max)
        m["series"], m["name"] = assign_series_name(m, len(machines) + 1)
        machines.append(m)

    df = pd.DataFrame(machines)
    df["source_url"] = "https://example-retailer.vn/mock"
    df["collected_at"] = "2026-01-15"
    df["image_url"] = ""
    df["retailer_category"] = df["segment"].map({
        "OFFICE": "Hoc tap - Van phong", "ULTRABOOK": "Mong nhe",
        "GAMING": "Laptop Gaming", "CREATOR": "Do hoa - Ky thuat",
    })

    # bang benchmark (diem PassMark that)
    cpu_rows = [{"pattern": p, "display_name": n, "raw_score": s, "source": BENCH_SOURCE_CPU} for p, n, s, _, _, _ in CPUS]
    gpu_rows = [
        {"pattern": p, "display_name": n, "raw_score": s, "dedicated": int(kind == "dgpu"),
         "vram_gb": vram if vram else "", "source": BENCH_SOURCE_GPU}
        for p, n, s, kind, _, _, _, vram, _ in GPUS
    ]
    pd.DataFrame(cpu_rows).to_csv(PROCESSED / "cpu_benchmark.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(gpu_rows).to_csv(PROCESSED / "gpu_benchmark.csv", index=False, encoding="utf-8-sig")

    out_cols = [
        "sku", "brand", "brand_tier", "series", "name", "cpu_model", "gpu_model", "ram_gb", "ssd_gb",
        "screen_inch", "resolution", "refresh_hz", "srgb_100", "weight_kg", "battery_wh",
        "price_vnd", "original_price_vnd", "sales_count",
        "retailer_category", "image_url", "source_url", "collected_at", "segment",
    ]
    df[out_cols].to_csv(PROCESSED / "catalog_vn.csv", index=False, encoding="utf-8-sig")
    df[[c for c in out_cols if c != "segment"]].to_excel(RAW / "catalog_vn_raw.xlsx", index=False)

    print(f"Da sinh {len(df)} laptop -> data/processed/catalog_vn.csv")
    print("\nPhan bo phan khuc:")
    print(df["segment"].value_counts())
    print("\nGia theo phan khuc (trieu VND):")
    print((df.groupby("segment")["price_vnd"].describe()[["min", "50%", "max"]] / 1e6).round(1))
    print("\nSo cap CPU-GPU khac nhau:", df.groupby(["cpu_model", "gpu_model"]).ngroups)
    print("\nKiem tra chong lan gia (GAMING vs CREATOR):")
    for seg in SEGMENTS:
        sub = df[df["segment"] == seg]
        print(f"  {seg:10s} n={len(sub):4d}  gia {sub['price_vnd'].min()/1e6:5.1f} - {sub['price_vnd'].max()/1e6:5.1f} tr")


if __name__ == "__main__":
    main()
