#!/usr/bin/env python3
"""
Icon generation script for Principal ADE Electron app
Generates all required icon sizes from a single source image
"""

import os
import sys
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageChops

def create_rounded_rectangle_mask(size, radius):
    """Create a mask for rounded corners with anti-aliasing"""
    # Create mask at 4x resolution for better anti-aliasing
    scale = 4
    large_size = size * scale
    large_radius = radius * scale

    mask = Image.new('L', (large_size, large_size), 0)
    draw = ImageDraw.Draw(mask)

    # Draw a rounded rectangle at high resolution
    draw.rounded_rectangle(
        [(0, 0), (large_size-1, large_size-1)],
        radius=large_radius,
        fill=255
    )

    # Downscale with high-quality resampling for smooth edges
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)

    return mask

def apply_rounded_corners(img, corner_radius_percent=0.18):
    """Apply rounded corners to an image"""
    size = min(img.width, img.height)
    corner_radius = int(size * corner_radius_percent)

    # Create a mask for the rounded corners
    mask = create_rounded_rectangle_mask(img.width, corner_radius)

    # Create output image with rounded corners
    output = Image.new('RGBA', (img.width, img.height), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)

    return output

def process_icon_with_padding(source_img, target_size, padding_percent=100/1024, corner_radius_percent=0.18):
    """
    Process an icon with padding and rounded corners

    Args:
        source_img: PIL Image object
        target_size: Final size of the icon (including padding)
        padding_percent: Percentage of padding (100/1024 = 9.765625%, Apple's exact spec: 100px on 1024px canvas)
        corner_radius_percent: Corner radius as percentage of icon size (0.18 = 18%)
    """
    # Calculate content size (icon size minus padding)
    content_size = int(target_size * (1 - padding_percent * 2))

    # Convert to RGBA if needed
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')

    # Create a copy and resize
    img = source_img.copy()
    img.thumbnail((content_size, content_size), Image.Resampling.LANCZOS)

    # Apply rounded corners to the image BEFORE adding padding
    img = apply_rounded_corners(img, corner_radius_percent)

    # Create a new image with transparent background for the final output
    # The source image already has its background, this is just for the padding area
    final_img = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))

    # Calculate position to center the rounded image
    x = (target_size - img.width) // 2
    y = (target_size - img.height) // 2

    # Paste the rounded image centered
    final_img.paste(img, (x, y), img)

    return final_img

def process_icon_no_padding(source_img, target_size, corner_radius_percent=0.18):
    """Process an icon without padding but with rounded corners"""
    # Convert to RGBA if needed
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')

    # Resize the image
    img = source_img.resize((target_size, target_size), Image.Resampling.LANCZOS)

    # Apply rounded corners
    corner_radius = int(target_size * corner_radius_percent)
    mask = create_rounded_rectangle_mask(target_size, corner_radius)

    # Create output image with rounded corners
    output = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)

    return output

def load_badge_font(size):
    """Load a bold system font for the badge text, falling back to default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

def add_dev_ribbon(icon, text="DEV", ribbon_color=(229, 72, 77, 255),
                   text_color=(255, 255, 255, 255)):
    """Composite a diagonal corner ribbon onto a (padded, rounded) icon.

    The ribbon is drawn across the bottom-right corner and then clipped to
    the icon body's alpha so it follows the rounded squircle edge.
    """
    icon = icon.convert("RGBA")
    size = icon.width

    # Short ribbon band tucked into the bottom-right corner (~13% tall).
    band_h = int(size * 0.135)
    band_w = int(size * 0.52)
    band = Image.new("RGBA", (band_w, band_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([0, 0, band_w, band_h], fill=ribbon_color)

    # Centered, letter-spaced text.
    spaced = " ".join(list(text))
    font = load_badge_font(int(band_h * 0.5))
    tb = bd.textbbox((0, 0), spaced, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    bd.text(((band_w - tw) / 2 - tb[0], (band_h - th) / 2 - tb[1]),
            spaced, font=font, fill=text_color)

    # Rotate to a "/" banner and center it near the bottom-right corner.
    band = band.rotate(45, expand=True, resample=Image.BICUBIC)
    corner = int(size * 0.80)
    overlay = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    overlay.paste(band, (corner - band.width // 2, corner - band.height // 2), band)

    out = Image.alpha_composite(icon, overlay)
    # Clip ribbon to the icon body so it follows the rounded edge.
    out.putalpha(ImageChops.multiply(out.getchannel("A"), icon.getchannel("A")))
    return out

def generate_electron_icons(source_img, output_dir):
    """Generate icons for the Electron app"""
    print("\nGenerating Electron app icons...")

    # Create icons directory
    icons_dir = os.path.join(output_dir, "icons")
    os.makedirs(icons_dir, exist_ok=True)

    # Icon sizes to generate
    sizes = [1024, 512, 256, 128, 96, 64, 48, 32, 24, 16]

    # Generate Mac icons with padding
    print("  Generating Mac icons (with padding)...")
    for size in sizes:
        img = process_icon_with_padding(source_img, size)
        # Save to icons directory with simple naming
        output_path = os.path.join(icons_dir, f"{size}x{size}.png")
        img.save(output_path, 'PNG')
        print(f"    ✓ {size}x{size}.png")

        # Also save versioned copies for backwards compatibility
        output_path = os.path.join(icons_dir, f"icon-{size}x{size}.png")
        img.save(output_path, 'PNG')

    # Generate icons without padding
    print("  Generating standard icons (no padding)...")
    for size in sizes:
        img = process_icon_no_padding(source_img, size)
        output_path = os.path.join(icons_dir, f"icon-{size}x{size}-no-padding.png")
        img.save(output_path, 'PNG')

    # Create Mac .icns file
    if sys.platform == 'darwin':
        print("  Creating Mac .icns file...")
        iconset_dir = os.path.join(output_dir, "icon.iconset")
        os.makedirs(iconset_dir, exist_ok=True)

        # Icon mapping for iconset
        icon_mapping = {
            "icon_16x16.png": 16,
            "icon_16x16@2x.png": 32,
            "icon_32x32.png": 32,
            "icon_32x32@2x.png": 64,
            "icon_128x128.png": 128,
            "icon_128x128@2x.png": 256,
            "icon_256x256.png": 256,
            "icon_256x256@2x.png": 512,
            "icon_512x512.png": 512,
            "icon_512x512@2x.png": 1024,
        }

        for filename, size in icon_mapping.items():
            img = process_icon_with_padding(source_img, size)
            dst = os.path.join(iconset_dir, filename)
            img.save(dst, 'PNG')

        # Generate .icns file
        icns_path = os.path.join(output_dir, "icon.icns")
        os.system(f"iconutil -c icns '{iconset_dir}' -o '{icns_path}'")

        # Clean up iconset directory
        shutil.rmtree(iconset_dir)
        print(f"    ✓ Created: icon.icns")

    # Generate Windows .ico file
    print("  Creating Windows .ico file...")
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = []

    for size in ico_sizes:
        img = process_icon_with_padding(source_img, size)
        ico_images.append(img)

    ico_path = os.path.join(output_dir, "icon.ico")
    ico_images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in ico_sizes])
    print(f"    ✓ Created: icon.ico")

def main():
    # Default source icon path - using the principal-ade-icon.png in current directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_icon = os.path.join(script_dir, "principal-ade-icon.png")

    # Allow custom source path as argument
    if len(sys.argv) > 1:
        source_icon = sys.argv[1]

    # Check if source exists
    if not os.path.exists(source_icon):
        print(f"Error: Source icon not found at {source_icon}")
        print(f"\nUsage: {sys.argv[0]} [source-icon-path]")
        print(f"Default source: principal-ade-icon.png in the same directory")
        sys.exit(1)

    print(f"Processing icon: {source_icon}")

    # Load source image once
    source_img = Image.open(source_icon)
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')

    # Generate Electron icons in assets directory
    electron_output_dir = os.path.join(script_dir, "assets")
    generate_electron_icons(source_img, electron_output_dir)

    # Dev-badged icon for non-packaged builds (applied via app.dock.setIcon).
    print("\nGenerating dev-badged icon...")
    dev_base = process_icon_with_padding(source_img, 1024)
    dev_icon = add_dev_ribbon(dev_base, "DEV")
    dev_path = os.path.join(electron_output_dir, "icon-dev.png")
    dev_icon.save(dev_path, "PNG")
    print(f"    ✓ {os.path.relpath(dev_path, script_dir)}")

    print("\n✅ All icons generated successfully!")
    print("\nIcon locations:")
    print(f"  - Electron app icons: {electron_output_dir}/")
    print(f"  - Electron icon set: {electron_output_dir}/icons/")

if __name__ == "__main__":
    main()