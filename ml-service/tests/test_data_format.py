"""Kiểm tra file catalog sửa bằng Excel: định dạng sai phải bị báo lỗi rõ ràng, file thật phải qua."""
import io

import pandas as pd

from app.data.data_check import CATALOG_PATH, check_catalog_format


def test_real_catalog_passes():
    assert check_catalog_format(pd.read_csv(CATALOG_PATH)) == []


def test_semicolon_file_is_explained():
    # Excel tiếng Việt hay lưu bằng dấu ; -> pandas đọc ra 1 cột duy nhất
    df = pd.read_csv(io.StringIO("sku;brand;segment\nA1;ASUS;GAMING\n"))
    errors = check_catalog_format(df)
    assert len(errors) == 1 and "dấu chấm phẩy" in errors[0]


def test_decimal_comma_and_bad_segment_detected():
    df = pd.read_csv(CATALOG_PATH).head(5).copy()
    df["weight_kg"] = ["2,51", "1,3", "1,9", "2,0", "1,1"]  # dấu phẩy thập phân kiểu Việt
    df.loc[0, "segment"] = "gaming"  # viết thường
    errors = check_catalog_format(df)
    assert any("weight_kg" in e for e in errors)
    assert any("segment" in e for e in errors)
