"""Mô hình C: phân loại NHU CẦU từ câu nói tự do bằng TF-IDF + kNN.

Người dùng gõ một câu như "con học kế toán, cần máy bền, rẻ" và hệ thống tự suy ra nhóm
nhu cầu + hồ sơ ưu tiên, thay vì bắt chọn dropdown/thanh kéo.

  câu văn -> TF-IDF (word 1-2gram + char_wb 3-5gram) -> kNN(cosine) -> nhãn nhu cầu
  nhãn nhu cầu -> NEED_PROFILES -> priorities / activities / ràng buộc
  ngân sách và ràng buộc cụ thể được bắt thêm bằng regex (chỉ hỗ trợ, không phân loại)

char_wb n-gram giúp chịu được tiếng Việt không dấu và lỗi gõ ("ke toan" ~ "kế toán").
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
DATA_DIR = Path(__file__).resolve().parents[3] / "data"
PHRASES_PATH = DATA_DIR / "need_phrases.json"

# Nhãn nhu cầu -> hồ sơ ưu tiên (admin chỉnh được qua KnowledgeConfig).
# priorities thang 1..5 như wizard; activities dùng cho Mô hình A.
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
    """Chữ thường, bỏ dấu, gọn khoảng trắng. Bỏ dấu để câu gõ không dấu vẫn khớp tập huấn luyện."""
    text = strip_accents(str(text).lower())
    # Giữ dấu thập phân nằm giữa hai chữ số ("1.4kg", "12,5 trieu"), xóa các dấu câu khác
    text = re.sub(r"(?<!\d)[.,](?!\d)", " ", text)
    text = re.sub(r"[^\w\s.,]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def build_text_pipeline(n_neighbors: int = 5) -> Pipeline:
    """Pipeline TF-IDF -> kNN: biến một câu văn thành một nhãn nhu cầu.

    TF-IDF gộp hai loại bằng FeatureUnion:
      - word 1-2gram: bắt cụm từ có nghĩa như "ke toan", "choi game".
      - char_wb 3-5gram: bắt từ gần giống nhau dù sai chính tả hoặc không dấu
        ("kê toán" và "ke toan" chung nhiều chùm ký tự).

    kNN dùng cosine vì với văn bản, hướng nội dung quan trọng hơn độ dài câu.
    weights="distance": câu học càng gần thì phiếu bầu càng nặng.
    """
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
# Trích xuất ngân sách và ràng buộc cụ thể (tri thức hỗ trợ, không phải phân loại)
# ---------------------------------------------------------------------------
_NUM = r"(\d+(?:[.,]\d+)?)"
_UNIT = r"(?:trieu|tr|cu|m)\b"


def extract_budget(text: str) -> tuple[int, int] | None:
    """Bắt các dạng: '15 trieu', 'duoi 20tr', 'tam 12-15 trieu', 'khoang 20 cu', 'tu 10 den 15 trieu'."""
    t = normalize_text(text)

    # khoảng: "12-15 trieu", "tu 10 den 15 trieu"
    m = re.search(rf"{_NUM}\s*(?:-|den|toi|~)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        lo, hi = (float(x.replace(",", ".")) for x in m.groups())
        return int(lo * 1_000_000), int(hi * 1_000_000)

    # giới hạn trên: "duoi 20 trieu", "khong qua 20tr", "toi da 20 trieu"
    m = re.search(rf"(?:duoi|khong qua|toi da|it hon|tam duoi)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        hi = float(m.group(1).replace(",", "."))
        return int(hi * 0.6 * 1_000_000), int(hi * 1_000_000)

    # giới hạn dưới: "tren 20 trieu", "tu 20 trieu"
    m = re.search(rf"(?:tren|tu)\s*{_NUM}\s*{_UNIT}", t)
    if m:
        lo = float(m.group(1).replace(",", "."))
        return int(lo * 1_000_000), int(lo * 1.5 * 1_000_000)

    # một con số: "tam 15 trieu", "khoang 15tr", "15 trieu"
    m = re.search(rf"(?:tam|khoang|gia|gan|co)?\s*{_NUM}\s*{_UNIT}", t)
    if m:
        v = float(m.group(1).replace(",", "."))
        if 4 <= v <= 150:  # lọc nhiễu, ví dụ "ram 16" hay "man 15 inch" không có đơn vị triệu
            return int(v * 0.85 * 1_000_000), int(v * 1.15 * 1_000_000)
    return None


def extract_constraints(text: str) -> dict:
    """Bắt ràng buộc cứng người dùng nói rõ: RAM tối thiểu, trọng lượng tối đa, SSD."""
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


# Từ khóa chỉnh mức ưu tiên, cộng vào hồ sơ do kNN suy ra.
# (regex, nhóm ưu tiên, mức thay đổi, mô tả hiển thị cho người dùng)
PRIORITY_HINTS = [
    (r"\b(re|gia re|tiet kiem|it tien|binh dan|sinh vien ngheo|ngan sach thap)\b", "price", +2, "muốn tiết kiệm chi phí"),
    (r"\b(cao cap|sang|khong quan trong gia|bao nhieu cung duoc)\b", "price", -2, "không đặt nặng giá"),
    (r"\b(nhe|mong nhe|gon|de mang|di chuyen|cong tac|pin trau|pin lau)\b", "mobility", +2, "cần nhẹ / pin lâu"),
    (r"\b(manh|khoe|cau hinh cao|muot|khung|nang)\b", "performance", +1, "cần cấu hình mạnh"),
    (r"\b(man dep|mau chuan|srgb|do phan giai cao|4k|man hinh tot)\b", "display", +2, "cần màn hình đẹp"),
    (r"\b(ben|do ben|it hong|bao hanh tot)\b", "brand", +1, "ưu tiên thương hiệu bền, uy tín"),
]


def apply_hints(priorities: dict, text: str) -> tuple[dict, list[str]]:
    """Chỉnh hồ sơ ưu tiên theo từ khóa trong câu; trả (priorities, danh sách mô tả để hiển thị)."""
    t = normalize_text(text)
    out = dict(priorities)
    matched: list[str] = []
    for pattern, key, delta, description in PRIORITY_HINTS:
        if not re.search(pattern, t):
            continue
        matched.append(description)
        if key == "brand":
            out["brand_weight"] = out.get("brand_weight", 1.0) + 0.6  # ưu tiên hãng uy tín
        else:
            out[key] = int(np.clip(out.get(key, 3) + delta, 1, 5))
    return out, matched


class NeedTextModel:
    """Bọc pipeline và logic suy hồ sơ nhu cầu từ câu văn."""

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
        """Trả nhãn, độ tin cậy và các câu láng giềng để giải thích cho người dùng."""
        x = normalize_text(text)
        proba = self.pipeline.predict_proba([x])[0]
        classes = self.pipeline.named_steps["knn"].classes_
        order = np.argsort(proba)[::-1]

        # Láng giềng gần nhất, để giải thích "vì sao đoán vậy"
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
        """Câu văn -> hồ sơ nhu cầu đầy đủ, làm vector truy vấn cho Mô hình B."""
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
