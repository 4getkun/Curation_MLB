"""PWAアイコン生成スクリプト(開発時に1回だけ実行するツール。ビルド時には実行されない)。
サイトのアクセントカラーを背景に、白いボールと赤い縫い目のシンプルな
野球アイコンを描画し、192px/512pxのPNGとして public/icons/ に書き出す。
"""
from PIL import Image, ImageDraw
import math

ACCENT = (217, 72, 31)  # --accent
WHITE = (255, 255, 255)
STITCH = (217, 72, 31)


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 角丸背景
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=ACCENT)

    # ボール(白い円)
    cx, cy = size / 2, size / 2
    ball_r = size * 0.32
    draw.ellipse(
        [cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r],
        fill=WHITE,
    )

    # 縫い目(2本のカーブをシンプルな円弧の連なりで表現)
    stitch_w = max(2, int(size * 0.018))
    for sign in (-1, 1):
        bbox = [
            cx - ball_r * 1.05 + sign * ball_r * 0.55,
            cy - ball_r * 1.05,
            cx + ball_r * 1.05 + sign * ball_r * 0.55,
            cy + ball_r * 1.05,
        ]
        start = 200 if sign < 0 else -20
        end = 340 if sign < 0 else 120
        draw.arc(bbox, start=start, end=end, fill=STITCH, width=stitch_w)

    # 縫い目の点々
    dot_r = max(1, int(size * 0.009))
    for sign in (-1, 1):
        base_cx = cx + sign * ball_r * 0.55
        base_cy = cy
        for t in range(-3, 4):
            angle = math.radians(t * 18)
            px = base_cx + math.sin(angle) * ball_r * 0.9 * sign * -1
            py = base_cy + math.cos(angle) * ball_r * 0.78 - ball_r * 0.05
            draw.ellipse([px - dot_r, py - dot_r, px + dot_r, py + dot_r], fill=STITCH)

    return img


for size in (192, 512):
    icon = draw_icon(size)
    icon.save(f"public/icons/icon-{size}.png")

print("done")
