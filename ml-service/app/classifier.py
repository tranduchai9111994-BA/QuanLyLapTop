"""Mo hinh A: kNN PHAN LOP phan khuc laptop (docs/04 SS3).

Khac voi Mo hinh B (retriever.py - TIM may gan giong nhu cau), Mo hinh A tra loi cau hoi khac:
"Cho mot cau hinh laptop (CPU, GPU, RAM,...), no thuoc phan khuc nao trong 4 nhom
OFFICE/ULTRABOOK/GAMING/CREATOR?"

Dung khi nao:
  1. Nhan vien them laptop moi -> AI goi y phan khuc (xem SegmentSuggester.tsx o frontend)
  2. Nguoi dung wizard chon "Chua ro nhu cau" -> suy phan khuc tu hoat dong (segment_inference.py)

Thuat toan: KNeighborsClassifier cua scikit-learn - phien ban "phan lop" (classification) cua
kNN, khac voi NearestNeighbors "truy hoi" (retrieval) dung trong retriever.py. Ca hai deu dua
tren cung nguyen ly: tim k lang gieng gan nhat, nhung Mo hinh A dung k lang gieng do de BO PHIEU
ra MOT NHAN (vd "3/5 lang gieng la GAMING nen du doan GAMING"), con Mo hinh B tra ve CHINH cac
lang gieng do lam ket qua (khong bo phieu).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline

from app.features import MODEL_A_FEATURES, build_model_a_preprocessor

RANDOM_STATE = 42  # co dinh de ket qua tai lap duoc giua cac lan chay (docs yeu cau)

# Khong gian tham so de GridSearchCV tim ra bo tham so kNN tot nhat:
#   n_neighbors: k = 1, 3, 5, ..., 31 (so LE de tranh hoa phieu khi bieu quyet 50-50)
#   weights: "uniform" = moi lang gieng 1 phieu | "distance" = lang gieng gan hon phieu nang hon
#   metric: cach do khoang cach - Euclidean (duong thang) hay Manhattan (tong tri tuyet doi)
PARAM_GRID = {
    "knn__n_neighbors": list(range(1, 32, 2)),
    "knn__weights": ["uniform", "distance"],
    "knn__metric": ["euclidean", "manhattan"],
}


def build_pipeline() -> Pipeline:
    """Dung "day chuyen" xu ly: chuan hoa du lieu (buoc "prep") -> phan lop kNN (buoc "knn").

    QUAN TRONG: Scaler PHAI nam trong Pipeline nay (khong duoc fit scaler rieng ben ngoai roi
    moi dua vao kNN). Neu fit ben ngoai, khi chay cross-validation, scaler se "nhin thay" ca
    du lieu validation truoc khi model duoc danh gia tren no - goi la RO RI DU LIEU (data
    leakage), lam diem so cao gia tao. Dat trong Pipeline giup scikit-learn tu dong fit lai
    scaler CHI tren tap train o moi fold. Xem test_scaler_inside_pipeline trong thu muc tests/.
    """
    return Pipeline([
        ("prep", build_model_a_preprocessor()),
        ("knn", KNeighborsClassifier()),
    ])


def grid_search(X: pd.DataFrame, y: pd.Series) -> GridSearchCV:
    """Thu TAT CA to hop tham so trong PARAM_GRID, chon bo tot nhat theo macro-F1.

    Dung StratifiedKFold (5 phan) thay vi KFold thuong: "Stratified" dam bao moi phan (fold)
    co ty le cac phan khuc GIONG NHAU voi toan bo du lieu - quan trong vi lop CREATOR it mau
    hon han GAMING/OFFICE, neu chia ngau nhien co the co fold thieu han mau CREATOR.

    Vi sao cham diem bang macro-F1 chu khong phai accuracy (docs/04 SS3.4): accuracy de bi
    "lua" boi lop dong (vd du doan toan GAMING/OFFICE van dung phan lon, du bo qua CREATOR
    hoan toan). macro-F1 tinh F1 rieng cho TUNG lop roi lay TRUNG BINH DEU, nen mo hinh bo
    qua lop nho se bi phat diem ro rang.
    """
    pipe = build_pipeline()
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    search = GridSearchCV(
        pipe, PARAM_GRID, cv=cv, scoring="f1_macro", n_jobs=-1, return_train_score=True
    )
    search.fit(X[MODEL_A_FEATURES], y)
    return search


def rule_based_baseline(X: pd.DataFrame) -> np.ndarray:
    """Bo LUAT IF-ELSE thu cong, dung lam MOC SO SANH de chung minh kNN thuc su hoc duoc gi
    (docs/04 SS6.1) - khong phai chi "dat ten AI" cho mot bo luat co dinh.

    Luat (theo thu tu uu tien, kiem tra tu tren xuong):
      1. Co GPU roi VA tan so quet >= 120Hz  -> chac chan la may GAMING
      2. Man hinh chuan mau (sRGB 100%) VA CPU thuoc nhom manh (top 30%) -> CREATOR
      3. Nhe (<= 1.4kg) -> ULTRABOOK
      4. Con lai -> OFFICE (nhom "mac dinh" khi khong khop dieu kien nao o tren)

    Neu kNN KHONG vuot duoc bo luat nay ro ret, nghia la du lieu qua "sach" (ranh gioi phan
    khuc qua ro rang), khong the hien duoc gia tri cua hoc may so voi luat co dinh - xem
    ml-service/README.md muc "Ket qua hien tai" de biet lan phat hien van de nay.
    """
    preds = []
    p70_cpu = X["cpu_score"].quantile(0.70)
    for _, row in X.iterrows():
        if row["gpu_dedicated"] and row["refresh_hz"] >= 120:
            preds.append("GAMING")
        elif row["srgb_100"] and row["cpu_score"] >= p70_cpu:
            preds.append("CREATOR")
        elif row["weight_kg"] <= 1.4:
            preds.append("ULTRABOOK")
        else:
            preds.append("OFFICE")
    return np.array(preds)


def dummy_baseline(y_train: pd.Series) -> DummyClassifier:
    """Moc so sanh THAP NHAT: luon du doan nhan XUAT HIEN NHIEU NHAT trong tap huan luyen,
    bat ke dac trung dau vao la gi. Neu kNN khong vuot duoc ca moc nay, mo hinh vo dung."""
    clf = DummyClassifier(strategy="most_frequent")
    clf.fit(np.zeros((len(y_train), 1)), y_train)
    return clf


def k_curve(X: pd.DataFrame, y: pd.Series, best_weights: str, best_metric: str) -> list[dict]:
    """Ve "duong cong chon k": tinh macro-F1 (bang cross-validation) cho TUNG gia tri k rieng
    le, giu nguyen weights/metric da chon tot nhat. Ket qua dung de VE BIEU DO trong bao cao
    (docs/04 SS5.1) - truc X la k, truc Y la macro-F1, giup hoi dong THAY duoc vi sao chon k
    do (thay vi chi noi suong "da grid search").

    Y nghia hinh dang duong cong: k qua NHO (1-3) thuong nhay cam nhieu (mot mau la co the
    lam sai lech ket qua). k qua LON lam "mo" ranh gioi giua cac lop, thien ve lop chiem da
    so. Diem k toi uu thuong nam giua, noi duong cong dat dinh cao nhat.
    """
    from sklearn.model_selection import cross_val_score

    curve = []
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    for k in range(1, 32, 2):
        pipe = build_pipeline()
        pipe.set_params(knn__n_neighbors=k, knn__weights=best_weights, knn__metric=best_metric)
        scores = cross_val_score(pipe, X[MODEL_A_FEATURES], y, cv=cv, scoring="f1_macro", n_jobs=-1)
        curve.append({"k": k, "f1_macro_mean": float(scores.mean()), "f1_macro_std": float(scores.std())})
    return curve
