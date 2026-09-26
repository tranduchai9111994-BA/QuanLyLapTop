"""TIEU CHI 3 - "he thong thong minh len theo thoi gian": hoc them tu CAU NOI THAT cua nguoi dung.

Luong:
  1. Doc cac cau nhu cau THAT nguoi dung da go (luu trong RecommendationSession.needJson qua
     truong `needText` + `needLabel`), kem phan hoi 👍/👎 cua ho.
  2. Cau nao duoc 👍 (nguoi dung hai long voi ket qua) => nhan ma Mo hinh C doan la DUNG
     => bo sung vao tap huan luyen.
  3. Huan luyen lai Mo hinh C va so sanh chi so TRUOC / SAU.

Chay: python -m app.retrain_from_feedback            (che do that: goi API backend)
      python -m app.retrain_from_feedback --demo     (che do demo: mo phong cau moi, khong can backend)

Ghi chu trung thuc: day la vong lap hoc BAN GIAM SAT don gian (human-in-the-loop). Cau chi duoc
nhan vao khi co tin hieu 👍 - khong tu dong tin moi du doan cua chinh minh (tranh "echo chamber").
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import requests
from sklearn.model_selection import StratifiedKFold, cross_val_score

from app.text_classifier import NeedTextModel, build_text_pipeline, normalize_text

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PHRASES_PATH = DATA_DIR / "need_phrases.json"
BACKEND_URL = "http://localhost:4000/api"

# Che do --demo mo phong DONG THOI GIAN thuc te: nguoi dung go nhung cau voi tu ngu MA TAP GOC
# CHUA CO ("tiem tap hoa", "quay thuoc", "khai bao thue"...). Cac cau nay den theo 2 dot:
#   DOT 1 (den truoc, duoc 👍) -> he thong HOC them
#   DOT 2 (den sau, cung chu de nhung cau chu khac) -> dung de KIEM TRA xem co tot len that khong
# Cach do nay phan anh dung thuc te hon leave-one-out: he thong hoc tu qua khu de phuc vu tuong lai.
DEMO_BATCH_1 = [
    ("chị cần máy tính làm sổ sách cho tiệm tạp hóa, tiền ít thôi", "VAN_PHONG"),
    ("máy tính cho quầy thuốc nhập đơn hàng ngày", "VAN_PHONG"),
    ("em thi đại học xong cần máy học ngành quản trị kinh doanh", "HOC_TAP"),
    ("máy cho con học nghề sửa chữa ô tô, xem video hướng dẫn", "HOC_TAP"),
    ("mình mới chuyển nghề sang làm web, cần máy chạy nodejs", "LAP_TRINH"),
    ("cần máy chạy nhiều tab chrome và vscode không đơ", "LAP_TRINH"),
    ("em làm tiktok cần máy cắt ghép video nhanh", "DO_HOA"),
    ("cần máy chỉnh ảnh cưới số lượng lớn, màu phải chuẩn", "DO_HOA"),
    ("cần máy chơi game mô phỏng lái xe cấu hình cao", "GAMING"),
    ("máy chơi cờ vua online và game nhẹ, tầm 20 triệu", "GAMING"),
    ("cần máy mang theo khi đi thi công công trình", "DI_DONG"),
    ("laptop nhẹ cho hướng dẫn viên du lịch hay di chuyển", "DI_DONG"),
]

DEMO_BATCH_2 = [
    ("cần máy tính làm sổ sách cho cửa hàng tạp hóa nhà em", "VAN_PHONG"),
    ("máy khai báo thuế và xuất hóa đơn cho quầy thuốc", "VAN_PHONG"),
    ("em sắp vào đại học ngành quản trị, cần máy học", "HOC_TAP"),
    ("máy cho con học nghề cơ khí, xem video dạy nghề", "HOC_TAP"),
    ("mình chuyển nghề sang lập trình web, cần máy chạy nodejs", "LAP_TRINH"),
    ("laptop mở nhiều tab chrome với vscode không bị đơ", "LAP_TRINH"),
    ("em quay tiktok cần máy cắt ghép video cho nhanh", "DO_HOA"),
    ("cần máy chỉnh ảnh cưới hàng loạt, màu phải chính xác", "DO_HOA"),
    ("máy chơi game mô phỏng máy bay cấu hình cao", "GAMING"),
    ("cần máy chơi cờ tướng online và game nhẹ tầm 20 triệu", "GAMING"),
    ("cần máy mang ra công trường khi đi thi công", "DI_DONG"),
    ("laptop nhẹ cho người dẫn tour hay phải di chuyển", "DI_DONG"),
]

DEMO_NEW_SAMPLES = DEMO_BATCH_1 + DEMO_BATCH_2


def cv_macro_f1(samples: list[dict], k: int = 7) -> tuple[float, float]:
    X = [normalize_text(s["text"]) for s in samples]
    y = [s["label"] for s in samples]
    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    scores = cross_val_score(build_text_pipeline(k), X, y, cv=cv, scoring="f1_macro")
    return float(scores.mean()), float(scores.std())


def fetch_feedback_samples() -> list[tuple[str, str]]:
    """Lay cac cau THAT co phan hoi tich cuc tu backend (can dang nhap ADMIN)."""
    login = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={"email": "admin@smartlap.vn", "password": "Demo@123"},
        timeout=10,
    )
    login.raise_for_status()
    token = login.json()["data"]["token"]

    r = requests.get(
        f"{BACKEND_URL}/feedback/need-texts",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    r.raise_for_status()
    return [(row["text"], row["label"]) for row in r.json()["data"]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Dung cau mo phong thay vi goi backend")
    parser.add_argument("--apply", action="store_true", help="Ghi cau moi vao need_phrases.json")
    args = parser.parse_args()

    model = NeedTextModel()
    base_samples = model.load_samples()
    known = {normalize_text(s["text"]) for s in base_samples}

    if args.demo:
        new_pairs = DEMO_NEW_SAMPLES
        print("Che do DEMO: dung cau mo phong (khong goi backend)")
    else:
        try:
            new_pairs = fetch_feedback_samples()
        except Exception as exc:  # backend chua chay / chua co du lieu
            print(f"Khong lay duoc phan hoi that tu backend ({exc}).")
            print("Chay lai voi --demo de xem quy trinh hoat dong the nao.")
            return 1

    new_samples = [
        {"text": txt, "label": lab}
        for txt, lab in new_pairs
        if normalize_text(txt) not in known
    ]
    if not new_samples:
        print("Khong co cau moi nao de hoc them.")
        return 0

    print()
    print("=" * 70)
    print("TIEU CHI 3: HOC THEM TU PHAN HOI NGUOI DUNG")
    print("=" * 70)
    print(f"  Tap huan luyen cu : {len(base_samples)} cau")
    print(f"  Cau moi hoc them  : {len(new_samples)} cau (tu nguoi dung that / mo phong)")

    # --- Do 1 (DUNG): hoc tu DOT 1, danh gia tren DOT 2 (cac cau den sau, chua tung thay) ---
    if args.demo:
        learn_set = [{"text": t_, "label": l_} for t_, l_ in DEMO_BATCH_1 if normalize_text(t_) not in known]
        test_set = [{"text": t_, "label": l_} for t_, l_ in DEMO_BATCH_2 if normalize_text(t_) not in known]
    else:
        half = max(1, len(new_samples) // 2)
        learn_set, test_set = new_samples[:half], new_samples[half:]

    old_model = NeedTextModel(n_neighbors=7).fit()
    new_model = NeedTextModel(n_neighbors=7)
    new_model.samples = base_samples + learn_set
    new_model.fit()

    correct_before = correct_after = 0
    changed: list[tuple[dict, str, str]] = []
    for s in test_set:
        pb = old_model.predict(s["text"])["label"]
        pa = new_model.predict(s["text"])["label"]
        correct_before += pb == s["label"]
        correct_after += pa == s["label"]
        if pb != pa:
            changed.append((s, pb, pa))

    n = len(test_set)
    print()
    print(f"  [Do dung] Hoc tu {len(learn_set)} cau DOT 1, kiem tra tren {n} cau DOT 2 (chua tung thay):")
    print(f"     Truoc khi hoc : {correct_before}/{n} = {correct_before / n:.1%}")
    print(f"     Sau khi hoc   : {correct_after}/{n} = {correct_after / n:.1%}")
    print(f"     => Thay doi   : {(correct_after - correct_before) / n:+.1%}")

    if changed:
        print(f"\n  Cac cau doi ket qua sau khi hoc ({len(changed)}):")
        for s, pb, pa in changed[:6]:
            mark = "SUA DUNG" if pa == s["label"] else ("hong di" if pb == s["label"] else "van sai")
            print(f'     "{s["text"][:46]}" {pb} -> {pa} (dung: {s["label"]}) [{mark}]')

    # --- Do 2 (tham khao): CV tren hai tap KHAC NHAU - khong so sanh truc tiep duoc ---
    before_mean, before_std = cv_macro_f1(base_samples)
    after_mean, after_std = cv_macro_f1(base_samples + new_samples)
    print()
    print("  [Tham khao] macro-F1 cross-validation tren tung tap:")
    print(f"     Tap cu  ({len(base_samples)} cau): {before_mean:.4f} (+/- {before_std:.4f})")
    print(f"     Tap moi ({len(base_samples) + len(new_samples)} cau): {after_mean:.4f} (+/- {after_std:.4f})")
    print("     Luu y: hai con so nay do tren HAI TAP KHAC NHAU nen KHONG so sanh truc tiep duoc.")
    print("     Tap moi chua nhieu cach dien dat la hon nen bai toan kho hon, chi so co the giam")
    print("     trong khi he thong thuc te phuc vu duoc nhieu kieu cau hon (xem [Do dung] o tren).")

    if args.apply:
        data = json.loads(PHRASES_PATH.read_text(encoding="utf-8"))
        data["samples"].extend(new_samples)
        PHRASES_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  Da ghi {len(new_samples)} cau moi vao {PHRASES_PATH.name}.")
        print("  Chay lai `python -m app.train` de kich hoat mo hinh moi.")
    else:
        print("\n  (Chay lai voi --apply de thuc su ghi cau moi vao tap huan luyen)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
