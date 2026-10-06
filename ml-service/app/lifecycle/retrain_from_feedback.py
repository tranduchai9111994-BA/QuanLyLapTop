"""Mô hình C học thêm từ câu thật của người dùng (tiêu chí 3: hệ thống tốt lên theo thời gian).

Chỉ nhận câu có phản hồi tích cực (thích), không tự tin vào dự đoán của chính mình.
Chạy: python -m app.lifecycle.retrain_from_feedback          (lấy câu thật từ backend)
      python -m app.lifecycle.retrain_from_feedback --demo   (câu mô phỏng, không cần backend)
      thêm --apply để ghi câu mới vào need_phrases.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import requests
from sklearn.model_selection import StratifiedKFold, cross_val_score

from app.models.text_classifier import NeedTextModel, build_text_pipeline, normalize_text

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
PHRASES_PATH = DATA_DIR / "need_phrases.json"
BACKEND_URL = "http://localhost:4000/api"

# Dữ liệu mô phỏng cho --demo: đợt 1 để học thêm, đợt 2 (cùng chủ đề, khác chữ) để kiểm tra
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
    """Lấy câu thật có phản hồi tích cực từ backend (cần đăng nhập ADMIN)."""
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
    parser.add_argument("--demo", action="store_true", help="Dùng câu mô phỏng thay vì gọi backend")
    parser.add_argument("--apply", action="store_true", help="Ghi câu mới vào need_phrases.json")
    args = parser.parse_args()

    model = NeedTextModel()
    base_samples = model.load_samples()
    known = {normalize_text(s["text"]) for s in base_samples}

    if args.demo:
        new_pairs = DEMO_NEW_SAMPLES
        print("Chế độ DEMO: dùng câu mô phỏng (không gọi backend)")
    else:
        try:
            new_pairs = fetch_feedback_samples()
        except Exception as exc:  # backend chưa chạy hoặc chưa có dữ liệu
            print(f"Không lấy được phản hồi thật từ backend ({exc}).")
            print("Chạy lại với --demo để xem quy trình hoạt động.")
            return 1

    new_samples = [
        {"text": txt, "label": lab}
        for txt, lab in new_pairs
        if normalize_text(txt) not in known
    ]
    if not new_samples:
        print("Không có câu mới nào để học thêm.")
        return 0

    print()
    print("=" * 70)
    print("TIÊU CHÍ 3: HỌC THÊM TỪ PHẢN HỒI NGƯỜI DÙNG")
    print("=" * 70)
    print(f"  Tập huấn luyện cũ : {len(base_samples)} câu")
    print(f"  Câu mới học thêm  : {len(new_samples)} câu (từ người dùng thật hoặc mô phỏng)")

    # Phép đo đúng: học từ đợt 1, kiểm tra trên đợt 2 (câu đến sau, chưa từng thấy)
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
    print(f"  [Phép đo đúng] Học từ {len(learn_set)} câu ĐỢT 1, kiểm tra trên {n} câu ĐỢT 2 (chưa từng thấy):")
    print(f"     Trước khi học : {correct_before}/{n} = {correct_before / n:.1%}")
    print(f"     Sau khi học   : {correct_after}/{n} = {correct_after / n:.1%}")
    print(f"     => Thay đổi   : {(correct_after - correct_before) / n:+.1%}")

    if changed:
        print(f"\n  Các câu đổi kết quả sau khi học ({len(changed)}):")
        for s, pb, pa in changed[:6]:
            mark = "SỬA ĐÚNG" if pa == s["label"] else ("hỏng đi" if pb == s["label"] else "vẫn sai")
            print(f'     "{s["text"][:46]}" {pb} -> {pa} (đúng: {s["label"]}) [{mark}]')

    # Chỉ để tham khảo: hai tập khác nhau nên hai con số không so trực tiếp được
    before_mean, before_std = cv_macro_f1(base_samples)
    after_mean, after_std = cv_macro_f1(base_samples + new_samples)
    print()
    print("  [Tham khảo] macro-F1 kiểm thử chéo trên từng tập:")
    print(f"     Tập cũ  ({len(base_samples)} câu): {before_mean:.4f} (+/- {before_std:.4f})")
    print(f"     Tập mới ({len(base_samples) + len(new_samples)} câu): {after_mean:.4f} (+/- {after_std:.4f})")
    print("     Lưu ý: hai con số đo trên HAI TẬP KHÁC NHAU nên KHÔNG so sánh trực tiếp được.")
    print("     Tập mới có nhiều cách diễn đạt lạ hơn nên bài toán khó hơn, chỉ số có thể giảm")
    print("     dù hệ thống phục vụ được nhiều kiểu câu hơn (xem [Phép đo đúng] ở trên).")

    if args.apply:
        data = json.loads(PHRASES_PATH.read_text(encoding="utf-8"))
        data["samples"].extend(new_samples)
        PHRASES_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  Đã ghi {len(new_samples)} câu mới vào {PHRASES_PATH.name}.")
        print("  Chạy lại `python -m app.lifecycle.train` để kích hoạt mô hình mới.")
    else:
        print("\n  (Chạy lại với --apply để thực sự ghi câu mới vào tập huấn luyện)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
