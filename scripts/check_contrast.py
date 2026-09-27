"""Kiem chung tuong phan mau WCAG AA cho cac cap chu/nen chinh trong theme/tokens.ts (NFR-05,
Giai doan 7). Nguong AA: van ban thuong >= 4.5:1, van ban lon/UI component >= 3:1."""


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(hex1, hex2):
    l1 = luminance(hex_to_rgb(hex1))
    l2 = luminance(hex_to_rgb(hex2))
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


pairs = [
    ("textPrimary / bgPage", "#0F1B2D", "#F5F9FF"),
    ("textPrimary / bgSurface", "#0F1B2D", "#FFFFFF"),
    ("textSecondary / bgPage", "#4A5B73", "#F5F9FF"),
    ("textSecondary / bgSurface", "#4A5B73", "#FFFFFF"),
    ("textTertiary / bgSurface", "#5B6B85", "#FFFFFF"),
    ("white text / primary700 button", "#FFFFFF", "#0F4494"),
    ("white text / primary500 button", "#FFFFFF", "#1A73E8"),
    ("success / successBg", "#15803D", "#EAF8EF"),
    ("warning / warningBg", "#B45309", "#FFF6E5"),
    ("error / errorBg", "#C62828", "#FDECEC"),
    ("segment OFFICE / bg", "#0369A1", "#E6F4FB"),
    ("segment ULTRABOOK / bg", "#0F766E", "#E6F6F4"),
    ("segment GAMING / bg", "#C2410C", "#FDEFE7"),
    ("segment CREATOR / bg", "#9333EA", "#F4EAFD"),
    ("primary700 link / bgPage", "#0F4494", "#F5F9FF"),
    ("textTertiary / bgSubtle", "#5B6B85", "#F0F5FC"),
]

for name, fg, bg in pairs:
    c = contrast(fg, bg)
    aa_normal = "PASS" if c >= 4.5 else "FAIL"
    aa_large = "PASS" if c >= 3.0 else "FAIL"
    print(f"{name}: {c:.2f}  (AA van ban thuong {aa_normal}, AA lon/UI {aa_large})")
