from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


BLACK = (0, 0, 0, 255)
RESAMPLING = Image.Resampling.LANCZOS


def render_square(source: Image.Image, size: int, width_ratio: float, transparent: bool = False) -> Image.Image:
    background = (0, 0, 0, 0) if transparent else BLACK
    canvas = Image.new("RGBA", (size, size), background)
    target_width = round(size * width_ratio)
    target_height = round(target_width * source.height / source.width)
    resized = source.resize((target_width, target_height), RESAMPLING)
    x = (size - target_width) // 2
    y = (size - target_height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def generate_web(source: Image.Image, root: Path) -> None:
    icons = root / "public" / "icons"
    save(render_square(source, 192, 0.82), icons / "bm-training-pwa-192-v5.png")
    save(render_square(source, 512, 0.82), icons / "bm-training-pwa-512-v5.png")
    save(render_square(source, 512, 0.60), icons / "bm-training-maskable-512-v5.png")
    save(render_square(source, 180, 0.80), icons / "bm-training-apple-touch-v5.png")


def generate_android(source: Image.Image, root: Path) -> None:
    res = root / "app" / "src" / "main" / "res"
    densities = {
        "mdpi": (48, 82, 300),
        "hdpi": (72, 123, 450),
        "xhdpi": (96, 164, 600),
        "xxhdpi": (144, 246, 900),
        "xxxhdpi": (192, 328, 1200),
    }
    for density, (launcher_size, maskable_size, splash_size) in densities.items():
        save(
            render_square(source, launcher_size, 0.78),
            res / f"mipmap-{density}" / "ic_launcher.png",
        )
        save(
            render_square(source, maskable_size, 0.60, transparent=True),
            res / f"mipmap-{density}" / "ic_maskable.png",
        )
        save(
            render_square(source, splash_size, 0.82),
            res / f"drawable-{density}" / "splash.png",
        )
    save(render_square(source, 512, 0.82), root / "store_icon.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--web-root", type=Path)
    parser.add_argument("--android-root", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    alpha_box = source.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError("The official logo has no visible pixels")
    source = source.crop(alpha_box)

    if args.web_root:
        generate_web(source, args.web_root)
    if args.android_root:
        generate_android(source, args.android_root)


if __name__ == "__main__":
    main()
