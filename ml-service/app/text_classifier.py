"""Mo hinh C: phan loai NHU CAU tu CAU NOI TU DO bang TF-IDF + kNN.

Vi sao can mo hinh nay (gop y cua giang vien): chon tieu chi bang dropdown/thanh keo chi la
nhap lieu, khong phai "thong minh". Voi mo hinh nay, nguoi dung go mot cau tu nhien nhu
"con hoc ke toan, can may ben, re" va HE THONG tu suy ra nhom nhu cau + ho so uu tien.

Kien truc:
  cau van -> TF-IDF (word 1-2gram + char_wb 3-5gram) -> KNeighborsClassifier(cosine) -> nhan nhu cau
  nhan nhu cau -> bang tri thuc NEED_PROFILES -> vector uu tien / activities / rang buoc
  + trich xuat ngan sach & rang buoc cu the bang regex (chi la TRI THUC HO TRO, khong phan loai)

Dung char_wb n-gram de chiu duoc tieng Viet khong dau va loi go ("ke toan" ~ "kế toán").
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline, FeatureUnion

RANDOM_STATE = 42
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PHRASES_PATH = DATA_DIR / "need_phrases.json"

# ---------------------------------------------------------------------------
# Bang tri thuc: nhan nhu cau -> ho so uu tien (admin chinh duoc qua KnowledgeConfig)
# priorities theo thang 1..5 giong wizard; activities dung cho Mo hinh A (suy phan khuc)
# ---------------------------------------------------------------------------
NEED_PROFILES: dict[str, dict] = {
    "VAN_PHONG": {
        "ten_hien_thi": "Văn phòng – Kế toán",
        "priorities": {"performance": 2, "mobility": 3, "display": 2, "price": 5},
        "activities": ["van_phong"],
        "must": {},
        "budget_goi_y": [9_000_000, 16_000_000],
    },
    "HOC_TAP": {
        "ten_hien_thi": "Học tập – Sinh viên",
        "priorities": {"performance": 2, "mobility": 4, "display": 3, "price": 5},
        "activities": ["hoc_tap"],
        "must": {},
        "budget_goi_y": [10_000_000, 18_000_000],
    },
    "LAP_TRINH": {
        "ten_hien_thi": "Lập trình – CNTT",
        "priorities": {"performance": 4, "mobility": 3, "display": 3, "price": 3},
        "activities": ["lap_trinh"],
        "must": {"ramMin": 16},
        "budget_goi_y": [18_000_000, 30_000_000],
    },
    "DO_HOA": {
        "ten_hien_thi": "Đồ họa – Dựng phim",
        "priorities": {"performance": 5, "mobility": 2, "display": 5, "price": 2},
        "activities": ["do_hoa", "thiet_ke"],
        "must": {"ramMin": 16},
        "budget_goi_y": [25_000_000, 45_000_000],
    },
    "GAMING": {
        "ten_hien_thi": "Gaming – Giải trí",
        "priorities": {"performance": 5, "mobility": 1, "display": 4, "price": 3},
        "activities": ["choi_game"],
        "must": {},
        "budget_goi_y": [20_000_000, 35_000_000],
    },
    "DI_DONG": {
        "ten_hien_thi": "Di động – Công tác",
        "priorities": {"performance": 2, "mobility": 5, "display": 3, "price": 3},
        "activities": ["di_chuyen_nhieu"],
        "must": {},
        "budget_goi_y": [15_000_000, 28_000_000],
    },
}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize_text(text: str) -> str:
    """Chuan hoa cau: chu thuong + bo dau + gon khoang trang. Bo dau giup cau go khong dau
    ("can may cho con hoc ke toan") van khop voi cau co dau trong tap huan luyen."""
    text = strip_accents(str(text).lower())
    # Giu dau thap phan nam GIUA hai chu so ("1.4kg", "12,5 trieu"), xoa moi dau cau khac
    text = re.sub(r"(?<!\d)[.,](?!\d)", " ", text)
    text = re.sub(r"[^\w\s.,]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def build_text_pipeline(n_neighbors: int = 5) -> Pipeline:
    """TF-IDF (ket hop word + char n-gram) roi kNN cosine - kNN la LOI phan loai."""
    return Pipeline([
        (
            "tfidf",
            FeatureUnion([
                ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
                ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)),
            ]),
        ),
        ("knn", KNeighborsClassifier(n_neighbors=n_neighbors, metric="cosine", weights="distance")),
    ])


# ---------------------------------------------------------------------------
# Trich xuat ngan sach & rang buoc cu the (TRI THUC HO TRO - khong phai phan loai)
# ---------------------------------------------------------------------------
_NUM = r"(\d+(?:[.,]\d+)?)"
_UNIT = r"(?:trieu|tr|cu|m)\b"


def extract_budget(text: str) -> tuple[int, int] | None:
    """Bat cac dang: '15 trieu', 'duoi 20tr', 'tam 12-15 trieu', 'khoang 20 cu', 'tu 10 den 15 trieu'."""
    t = normalize_text(text)

    # khoang: "12-15 trieu", "tu 10 den 15 trieu"
    m = re.search(rf"{_NUM}\s*(?:-|den|toi|~)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        lo, hi = (float(x.replace(",", ".")) for x in m.groups())
        return int(lo * 1_000_000), int(hi * 1_000_000)

    # gioi han tren: "duoi 20 trieu", "khong qua 20tr", "toi da 20 trieu"
    m = re.search(rf"(?:duoi|khong qua|toi da|it hon|tam duoi)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        hi = float(m.group(1).replace(",", "."))
        return int(hi * 0.6 * 1_000_000), int(hi * 1_000_000)

    # gioi han duoi: "tren 20 trieu", "tu 20 trieu"
    m = re.search(rf"(?:tren|tu)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        lo = float(m.group(1).replace(",", "."))
        return int(lo * 1_000_000), int(lo * 1.5 * 1_000_000)

    # mot con so: "tam 15 trieu", "khoang 15tr", "15 trieu"
    m = re.search(rf"(?:tam|khoang|gia|gan|co)?\s*{_NUM}\s*{_UNIT}", t)
    if m:
        v = float(m.group(1).replace(",", "."))
        if 4 <= v <= 150:  # loc nhieu (vd "ram 16", "man 15 inch" khong co don vi trieu)
            return int(v * 0.85 * 1_000_000), int(v * 1.15 * 1_000_000)
    return None


def extract_constraints(text: str) -> dict:
    """Bat rang buoc cung ma nguoi dung noi ro: RAM toi thieu, trong luong toi da, SSD."""
    t = normalize_text(text)
    must: dict[str, float] = {}

    m = re.search(r"ram\s*(?:it nhat|toi thieu|tu)?\s*(\d+)\s*(?:gb|g)\b", t)
    if m:
        must["ramMin"] = int(m.group(1))
    elif re.search(r"(\d+)\s*gb\s*ram", t):
        must["ramMin"] = int(re.search(r"(\d+)\s*gb\s*ram", t).group(1))

    m = re.search(r"(?:duoi|nhe hon|khong qua)\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilogam)", t)
    if m:
        must["weightMax"] = float(m.group(1).replace(",", "."))

    m = re.search(r"ssd\s*(\d+)\s*(?:gb|g)\b", t)
    if m:
        must["ssdMin"] = int(m.group(1))
    return must


# Tu khoa dieu chinh muc uu tien (tri thuc ho tro, cong vao ho so tu mo hinh kNN)
# (regex, nhom uu tien, muc thay doi, mo ta hien thi cho nguoi dung)
PRIORITY_HINTS = [
    (r"\b(re|gia re|tiet kiem|it tien|binh dan|sinh vien ngheo|ngan sach thap)\b", "price", +2, "muốn tiết kiệm chi phí"),
    (r"\b(cao cap|sang|khong quan trong gia|bao nhieu cung duoc)\b", "price", -2, "không đặt nặng giá"),
    (r"\b(nhe|mong nhe|gon|de mang|di chuyen|cong tac|pin trau|pin lau)\b", "mobility", +2, "cần nhẹ / pin lâu"),
    (r"\b(manh|khoe|cau hinh cao|muot|khung|nang)\b", "performance", +1, "cần cấu hình mạnh"),
    (r"\b(man dep|mau chuan|srgb|do phan giai cao|4k|man hinh tot)\b", "display", +2, "cần màn hình đẹp"),
    (r"\b(ben|do ben|it hong|bao hanh tot)\b", "brand", +1, "ưu tiên thương hiệu bền, uy tín"),
]


def apply_hints(priorities: dict, text: str) -> tuple[dict, list[str]]:
    """Dieu chinh ho so uu tien theo tu khoa xuat hien trong cau.
    Tra ve (priorities, danh sach MO TA de hien thi cho nguoi dung - khong phai tu tho da bo dau)."""
    t = normalize_text(text)
    out = dict(priorities)
    matched: list[str] = []
    for pattern, key, delta, description in PRIORITY_HINTS:
        if not re.search(pattern, t):
            continue
        matched.append(description)
        if key == "brand":
            out["brand_weight"] = out.get("brand_weight", 1.0) + 0.6  # uu tien hang uy tin
        else:
            out[key] = int(np.clip(out.get(key, 3) + delta, 1, 5))
    return out, matched


class NeedTextModel:
    """Boc pipeline + logic suy ho so nhu cau tu cau van."""

    def __init__(self, n_neighbors: int = 5) -> None:
        self.pipeline = build_text_pipeline(n_neighbors)
        self.samples: list[dict] = []
        self.n_neighbors = n_neighbors

    def load_samples(self) -> list[dict]:
        data = json.loads(PHRASES_PATH.read_text(encoding="utf-8"))
        self.samples = data["samples"]
        return self.samples

    def fit(self) -> "NeedTextModel":
        if not self.samples:
            self.load_samples()
        X = [normalize_text(s["text"]) for s in self.samples]
        y = [s["label"] for s in self.samples]
        self.pipeline.fit(X, y)
        return self

    def predict(self, text: str) -> dict:
        """Tra ve nhan + do tin cay + cac cau lang gieng (de GIAI THICH cho nguoi dung thay)."""
        x = normalize_text(text)
        proba = self.pipeline.predict_proba([x])[0]
        classes = self.pipeline.named_steps["knn"].classes_
        order = np.argsort(proba)[::-1]

        # Lay cac cau lang gieng gan nhat de minh bach (giai thich "vi sao doan nhu vay")
        features = self.pipeline.named_steps["tfidf"].transform([x])
        knn = self.pipeline.named_steps["knn"]
        k = min(self.n_neighbors, len(self.samples))
        dist, idx = knn.kneighbors(features, n_neighbors=k)
        neighbors = [
            {"text": self.samples[i]["text"], "label": self.samples[i]["label"], "distance": float(d)}
            for d, i in zip(dist[0], idx[0])
        ]

        return {
            "label": str(classes[order[0]]),
            "confidence": float(proba[order[0]]),
            "distribution": {str(classes[i]): float(proba[i]) for i in order},
            "neighbors": neighbors,
        }

    def parse_need(self, text: str) -> dict:
        """Cau van -> ho so nhu cau day du de dua vao Mo hinh B (vector truy van)."""
        pred = self.predict(text)
        profile = NEED_PROFILES[pred["label"]]

        priorities, hints = apply_hints(profile["priorities"], text)
        brand_weight = priorities.pop("brand_weight", 1.0)

        budget = extract_budget(text)
        budget_from_text = budget is not None
        if budget is None:
            budget = tuple(profile["budget_goi_y"])

        must = dict(profile["must"])
        must.update(extract_constraints(text))

        return {
            "label": pred["label"],
            "labelText": profile["ten_hien_thi"],
            "confidence": pred["confidence"],
            "distribution": pred["distribution"],
            "neighbors": pred["neighbors"],
            "priorities": priorities,
            "brandWeight": brand_weight,
            "activities": profile["activities"],
            "budget": {"min": int(budget[0]), "max": int(budget[1])},
            "budgetFromText": budget_from_text,
            "must": must,
            "hints": hints,
        }
