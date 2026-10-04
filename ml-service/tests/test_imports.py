"""Mọi câu lệnh import nội bộ (kể cả import đặt TRONG hàm) phải trỏ tới module/tên thật sự tồn tại.

Lý do có test này: import đặt trong hàm (vd main.py, endpoint /train) chỉ chạy khi endpoint được gọi nên
các test khác không phát hiện được khi dời file (lỗi từng xảy ra: `from app import train` sau khi train.py
chuyển vào app/lifecycle/).
"""
import ast
import importlib
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"


def _internal_imports():
    for path in APP_DIR.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):  # ast.walk đi vào cả thân hàm
            if isinstance(node, ast.ImportFrom) and node.module and node.module.split(".")[0] == "app":
                yield path.name, node.module, [a.name for a in node.names]
            elif isinstance(node, ast.Import):
                for a in node.names:
                    if a.name.split(".")[0] == "app":
                        yield path.name, a.name, []


def test_every_internal_import_resolves():
    broken = []
    for file, module, names in _internal_imports():
        try:
            mod = importlib.import_module(module)
        except ImportError as exc:
            broken.append(f"{file}: import {module} -> {exc}")
            continue
        for name in names:
            if name != "*" and not hasattr(mod, name):
                try:  # `from app.lifecycle import train`: tên là module con, không phải thuộc tính
                    importlib.import_module(f"{module}.{name}")
                except ImportError:
                    broken.append(f"{file}: from {module} import {name} (không tồn tại)")
    assert not broken, "\n".join(broken)
