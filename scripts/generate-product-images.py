#!/usr/bin/env python3
"""Generate the demo storefront's product images as flat SVG illustrations.

Every image under public/images/ is produced by this script. Nothing is
downloaded and no third-party asset is used, so the whole set is ours to
publish. Re-run with:  python3 scripts/generate-product-images.py
"""

import io
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "images")

W = H = 800
BG_LIGHT = "#f4f4f5"
BG_TINT = "#eceaea"
INK = "#1f2024"


def shade(hex_color, factor):
    """Lighten (factor > 1) or darken (factor < 1) a #rrggbb colour."""
    hex_color = hex_color.lstrip("#")
    parts = [int(hex_color[i:i + 2], 16) for i in (0, 2, 4)]
    out = []
    for p in parts:
        v = p * factor if factor <= 1 else p + (255 - p) * (factor - 1)
        out.append(max(0, min(255, int(round(v)))))
    return "#%02x%02x%02x" % tuple(out)


def frame(body, bg=BG_LIGHT):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
        'width="%d" height="%d" role="img">\n'
        '  <rect width="%d" height="%d" fill="%s"/>\n'
        '%s\n</svg>\n' % (W, H, W, H, W, H, bg, body)
    )


# --------------------------------------------------------------------------
# Headphones
# --------------------------------------------------------------------------

def overear_front(c, accent, pad):
    return """  <g transform="translate(400,410)">
    <path d="M -210 30 A 210 210 0 0 1 210 30" fill="none" stroke="%s" stroke-width="34" stroke-linecap="round"/>
    <path d="M -210 30 A 210 210 0 0 1 210 30" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round" opacity="0.5"/>
    <rect x="-262" y="20" width="104" height="190" rx="46" fill="%s"/>
    <rect x="158" y="20" width="104" height="190" rx="46" fill="%s"/>
    <rect x="-248" y="46" width="76" height="140" rx="34" fill="%s"/>
    <rect x="172" y="46" width="76" height="140" rx="34" fill="%s"/>
    <circle cx="-210" cy="116" r="17" fill="%s" opacity="0.65"/>
    <circle cx="210" cy="116" r="17" fill="%s" opacity="0.65"/>
  </g>""" % (c, accent, c, c, pad, pad, accent, accent)


def overear_side(c, accent, pad):
    return """  <g transform="translate(400,400)">
    <path d="M -60 -170 A 180 180 0 0 1 120 -30" fill="none" stroke="%s" stroke-width="32" stroke-linecap="round"/>
    <circle cx="-30" cy="60" r="155" fill="%s"/>
    <circle cx="-30" cy="60" r="112" fill="%s"/>
    <circle cx="-30" cy="60" r="62" fill="%s" opacity="0.55"/>
    <path d="M 100 -40 L 128 30" stroke="%s" stroke-width="20" stroke-linecap="round"/>
  </g>""" % (c, c, pad, accent, c)


def overear_detail(c, accent, pad):
    return """  <g transform="translate(400,400)">
    <circle cx="0" cy="0" r="250" fill="%s"/>
    <circle cx="0" cy="0" r="188" fill="%s"/>
    <circle cx="0" cy="0" r="120" fill="%s" opacity="0.5"/>
    <circle cx="0" cy="0" r="54" fill="%s" opacity="0.75"/>
    <circle cx="0" cy="0" r="18" fill="%s"/>
  </g>""" % (c, pad, accent, c, accent)


def earbuds_front(c, accent, pad):
    return """  <g transform="translate(400,400)">
    <rect x="-250" y="-40" width="240" height="210" rx="52" fill="%s"/>
    <rect x="-226" y="-16" width="192" height="76" rx="34" fill="%s" opacity="0.55"/>
    <g transform="translate(130,0)">
      <circle cx="0" cy="-30" r="82" fill="%s"/>
      <circle cx="0" cy="-30" r="44" fill="%s" opacity="0.6"/>
      <path d="M -26 34 q 26 46 52 0 l 0 96 q -26 30 -52 0 z" fill="%s"/>
    </g>
    <circle cx="-130" cy="122" r="14" fill="%s" opacity="0.7"/>
  </g>""" % (c, pad, c, pad, c, accent)


def earbuds_side(c, accent, pad):
    return """  <g transform="translate(400,400)">
    <circle cx="-10" cy="-60" r="132" fill="%s"/>
    <circle cx="-10" cy="-60" r="76" fill="%s" opacity="0.6"/>
    <path d="M -52 34 q 42 64 84 0 l 6 158 q -48 44 -96 0 z" fill="%s"/>
    <rect x="-30" y="150" width="60" height="26" rx="13" fill="%s" opacity="0.7"/>
  </g>""" % (c, pad, c, accent)


def earbuds_detail(c, accent, pad):
    return """  <g transform="translate(400,400)">
    <circle cx="0" cy="0" r="246" fill="%s"/>
    <circle cx="0" cy="0" r="170" fill="%s" opacity="0.55"/>
    <circle cx="0" cy="0" r="96" fill="%s"/>
    <circle cx="-34" cy="-34" r="26" fill="%s" opacity="0.8"/>
  </g>""" % (c, pad, accent, "#ffffff")


# --------------------------------------------------------------------------
# Clothing
# --------------------------------------------------------------------------

def _torso(c, neck_d, hem_y=640):
    return """    <path d="M 276 196 L 210 234 L 150 352 L 232 402 L 254 348 L 254 %d L 546 %d L 546 348 L 568 402 L 650 352 L 590 234 L 524 196 %s Z" fill="%s"/>""" % (hem_y, hem_y, neck_d, c)


def tee_front(c, accent, pad):
    neck = "L 470 196 A 76 54 0 0 1 330 196"
    return """  <g>
%s
    <path d="M 330 196 A 76 54 0 0 0 470 196" fill="none" stroke="%s" stroke-width="12"/>
    <path d="M 254 614 L 546 614" stroke="%s" stroke-width="8" opacity="0.45"/>
  </g>""" % (_torso(c, neck), accent, accent)


def tee_back(c, accent, pad):
    neck = "L 470 206 A 74 30 0 0 1 330 206"
    return """  <g>
%s
    <rect x="378" y="228" width="44" height="58" rx="10" fill="%s" opacity="0.8"/>
    <path d="M 254 614 L 546 614" stroke="%s" stroke-width="8" opacity="0.45"/>
  </g>""" % (_torso(c, neck), pad, accent)


def shirt_front(c, accent, pad):
    neck = "L 470 196 L 400 262 L 330 196"
    return """  <g>
%s
    <path d="M 400 262 L 400 640" stroke="%s" stroke-width="10" opacity="0.6"/>
    <path d="M 330 196 L 400 268 L 372 300 Z" fill="%s" opacity="0.85"/>
    <path d="M 470 196 L 400 268 L 428 300 Z" fill="%s" opacity="0.85"/>
    <circle cx="400" cy="386" r="11" fill="%s"/>
    <circle cx="400" cy="486" r="11" fill="%s"/>
    <circle cx="400" cy="586" r="11" fill="%s"/>
  </g>""" % (_torso(c, neck), accent, pad, pad, accent, accent, accent)


def shirt_back(c, accent, pad):
    neck = "L 470 206 A 74 32 0 0 1 330 206"
    return """  <g>
%s
    <path d="M 254 300 L 546 300" stroke="%s" stroke-width="10" opacity="0.55"/>
    <rect x="374" y="326" width="52" height="34" rx="8" fill="%s" opacity="0.75"/>
  </g>""" % (_torso(c, neck), accent, pad)


def sweater_front(c, accent, pad):
    neck = "L 470 196 A 78 46 0 0 1 330 196"
    return """  <g>
%s
    <path d="M 330 196 A 78 46 0 0 0 470 196" fill="none" stroke="%s" stroke-width="26"/>
    <rect x="254" y="600" width="292" height="46" fill="%s" opacity="0.55"/>
    <path d="M 340 300 L 340 590 M 400 300 L 400 590 M 460 300 L 460 590" stroke="%s" stroke-width="6" opacity="0.3"/>
  </g>""" % (_torso(c, neck), accent, accent, pad)


def fleece_front(c, accent, pad):
    neck = "L 470 176 L 400 214 L 330 176"
    return """  <g>
%s
    <path d="M 400 214 L 400 430" stroke="%s" stroke-width="16"/>
    <rect x="386" y="410" width="28" height="44" rx="8" fill="%s"/>
    <path d="M 330 176 L 470 176" stroke="%s" stroke-width="30" stroke-linecap="round"/>
    <path d="M 254 596 L 546 596" stroke="%s" stroke-width="10" opacity="0.4"/>
  </g>""" % (_torso(c, neck), accent, accent, accent, pad)


def trousers_front(c, accent, pad):
    return """  <g>
    <path d="M 286 168 L 514 168 L 528 300 L 512 690 L 424 690 L 400 372 L 376 690 L 288 690 L 272 300 Z" fill="%s"/>
    <path d="M 286 168 L 514 168 L 518 216 L 282 216 Z" fill="%s" opacity="0.7"/>
    <path d="M 400 216 L 400 372" stroke="%s" stroke-width="8" opacity="0.5"/>
    <path d="M 300 240 L 340 290 L 300 290 Z" fill="%s" opacity="0.6"/>
    <path d="M 500 240 L 460 290 L 500 290 Z" fill="%s" opacity="0.6"/>
    <circle cx="400" cy="192" r="10" fill="%s"/>
  </g>""" % (c, pad, accent, accent, accent, accent)


def trousers_back(c, accent, pad):
    return """  <g>
    <path d="M 286 168 L 514 168 L 528 300 L 512 690 L 424 690 L 400 372 L 376 690 L 288 690 L 272 300 Z" fill="%s"/>
    <path d="M 286 168 L 514 168 L 518 210 L 282 210 Z" fill="%s" opacity="0.6"/>
    <rect x="312" y="250" width="72" height="54" rx="8" fill="%s" opacity="0.55"/>
    <rect x="416" y="250" width="72" height="54" rx="8" fill="%s" opacity="0.55"/>
  </g>""" % (c, pad, accent, accent)


def fabric_detail(c, accent, pad):
    lines = "".join(
        '<path d="M %d 150 L %d 650" stroke="%s" stroke-width="7" opacity="0.28"/>' % (x, x, pad)
        for x in range(186, 640, 42)
    )
    return """  <g>
    <rect x="150" y="150" width="500" height="500" rx="34" fill="%s"/>
    %s
    <rect x="150" y="150" width="500" height="500" rx="34" fill="none" stroke="%s" stroke-width="12" opacity="0.5"/>
    <circle cx="560" cy="560" r="44" fill="%s" opacity="0.75"/>
  </g>""" % (c, lines, accent, accent)


SILHOUETTES = {
    "overear": [overear_front, overear_side, overear_detail],
    "onear": [overear_front, overear_side, overear_detail],
    "openback": [overear_front, overear_side, overear_detail],
    "earbuds": [earbuds_front, earbuds_side, earbuds_detail],
    "tee": [tee_front, tee_back, fabric_detail],
    "shirt": [shirt_front, shirt_back, fabric_detail],
    "sweater": [sweater_front, tee_back, fabric_detail],
    "fleece": [fleece_front, tee_back, fabric_detail],
    "trousers": [trousers_front, trousers_back, fabric_detail],
}

# slug -> (silhouette, {colour slug: hex})
PRODUCTS = {
    "aureal-h9-anc": ("overear", {"midnight": "#22304a", "sand": "#cbb79a", "slate": "#5d6472"}),
    "nordwave-drift": ("overear", {"black": "#24262b", "ivory": "#e6e0d4"}),
    "kestrel-k2-studio": ("overear", {"black": "#1e2024", "silver": "#b9bdc4"}),
    "lumen-halo-open": ("openback", {"graphite": "#3b3f46", "walnut": "#7b5334"}),
    "pinebank-trail-buds": ("earbuds", {"moss": "#4f6448", "bone": "#ded6c6", "ink": "#262a33"}),
    "verso-compact-on-ear": ("onear", {"navy": "#28354f", "rust": "#a4552f"}),
    "fieldhouse-heavyweight-tee": ("tee", {"black": "#232428", "heather-grey": "#a8aab0", "olive": "#5e6446"}),
    "meridian-oxford-shirt": ("shirt", {"white": "#eceef1", "sky": "#9fbcd6", "stone": "#c3bbaa"}),
    "torrey-merino-crew": ("sweater", {"charcoal": "#3c3f45", "oat": "#d3c7b1", "forest": "#31513f"}),
    "coastline-linen-shirt": ("shirt", {"natural": "#ded4c2", "indigo": "#38455f"}),
    "rampart-chino": ("trousers", {"khaki": "#bfa781", "navy": "#2c3752", "black": "#242529"}),
    "summit-quarter-zip": ("fleece", {"slate": "#5a6472", "moss": "#586b4c"}),
}


def main():
    written = 0
    for slug, (kind, colours) in PRODUCTS.items():
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        for colour_slug, hexv in colours.items():
            accent = shade(hexv, 0.62)
            pad = shade(hexv, 1.28)
            for i, render in enumerate(SILHOUETTES[kind], start=1):
                bg = BG_LIGHT if i != 3 else BG_TINT
                svg = frame(render(hexv, accent, pad), bg)
                path = os.path.join(folder, "%s-%d.svg" % (colour_slug, i))
                io.open(path, "w", encoding="utf-8").write(svg)
                written += 1
    print("wrote %d images across %d products" % (written, len(PRODUCTS)))


if __name__ == "__main__":
    main()
