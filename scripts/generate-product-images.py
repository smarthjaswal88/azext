#!/usr/bin/env python3
"""Generate the demo storefront's product imagery as shaded SVG illustrations.

Every image under public/images/ is produced by this script. Nothing is
downloaded and no third-party asset is used, so the whole set is ours to
publish with no attribution or licence obligation.

These are illustrations, not photographs. See public/images/README.md for why,
and for what was actually checked before settling on this.

Each product type has its own drawing — an over-ear headphone, an in-ear bud,
a crew tee, an oxford shirt, a knit sweater, a camp-collar shirt, a chino and a
quarter-zip are all drawn differently rather than recoloured from one shape.
Colour comes from the variant, so the image always matches the selection.

    python3 scripts/generate-product-images.py
"""

import io
import os

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "images"
)

W = H = 900
BG = "#f6f7f7"


# ---------------------------------------------------------------------------
# colour helpers
# ---------------------------------------------------------------------------

def shade(hex_color, factor):
    """factor < 1 darkens, > 1 lightens."""
    h = hex_color.lstrip("#")
    parts = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    out = []
    for p in parts:
        v = p * factor if factor <= 1 else p + (255 - p) * (factor - 1)
        out.append(max(0, min(255, int(round(v)))))
    return "#%02x%02x%02x" % tuple(out)


def luminance(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


class Palette:
    """Derived tones for one variant colour. Light colours are shaded downwards
    so a white shirt still reads as a shirt against a near-white background."""

    def __init__(self, base):
        self.base = base
        pale = luminance(base) > 0.72
        self.light = shade(base, 1.14 if not pale else 1.03)
        self.mid = base
        self.dark = shade(base, 0.80 if not pale else 0.88)
        self.deep = shade(base, 0.62 if not pale else 0.74)
        self.line = shade(base, 0.52 if not pale else 0.70)
        self.trim = shade(base, 0.40 if not pale else 0.62)
        self.pale = pale
        # Pale garments would otherwise dissolve into the near-white image
        # background, so they get a visible edge. Dark ones get a faint one.
        self.outline = shade(base, 0.62 if pale else 0.74)
        self.outline_width = 4 if pale else 2


def defs(p, extra=""):
    return f"""  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{p.light}"/>
      <stop offset="0.55" stop-color="{p.mid}"/>
      <stop offset="1" stop-color="{p.dark}"/>
    </linearGradient>
    <linearGradient id="bodyV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{p.light}"/>
      <stop offset="1" stop-color="{p.dark}"/>
    </linearGradient>
    <linearGradient id="sleeve" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{p.dark}"/>
      <stop offset="1" stop-color="{p.mid}"/>
    </linearGradient>
    <radialGradient id="cup" cx="0.36" cy="0.30" r="0.85">
      <stop offset="0" stop-color="{p.light}"/>
      <stop offset="0.6" stop-color="{p.mid}"/>
      <stop offset="1" stop-color="{p.deep}"/>
    </radialGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000000" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
{extra}  </defs>
"""


def frame(p, body, extra_defs="", shadow=(450, 760, 250, 34)):
    cx, cy, rx, ry = shadow
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}" role="img">\n'
        f'  <rect width="{W}" height="{H}" fill="{BG}"/>\n'
        f"{defs(p, extra_defs)}"
        f'  <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#shadow)"/>\n'
        f"{body}\n</svg>\n"
    )


# ---------------------------------------------------------------------------
# headphones
# ---------------------------------------------------------------------------

def _headband(p, cup_gap, thickness=30):
    """Arc joining the two cups, with padding along the underside."""
    left, right = 450 - cup_gap, 450 + cup_gap
    return f"""    <path d="M {left} 400 C {left} 150, {right} 150, {right} 400"
          fill="none" stroke="{p.deep}" stroke-width="{thickness}" stroke-linecap="round"/>
    <path d="M {left} 400 C {left} 150, {right} 150, {right} 400"
          fill="none" stroke="{p.light}" stroke-width="{thickness * 0.30:.0f}"
          stroke-linecap="round" opacity="0.55"/>
    <path d="M {left + 26} 330 C {left + 40} 205, {right - 40} 205, {right - 26} 330"
          fill="none" stroke="{p.trim}" stroke-width="16" stroke-linecap="round" opacity="0.85"/>"""


def overear_front(p, pad_ratio=1.0):
    gap = 200
    cw, ch = 150 * pad_ratio, 188 * pad_ratio
    return f"""  <g>
{_headband(p, gap)}
    <!-- yokes -->
    <rect x="{450 - gap - 13}" y="352" width="26" height="86" rx="13" fill="{p.trim}"/>
    <rect x="{450 + gap - 13}" y="352" width="26" height="86" rx="13" fill="{p.trim}"/>
    <!-- cups -->
    <rect x="{450 - gap - cw / 2}" y="418" width="{cw}" height="{ch}" rx="{cw * 0.44:.0f}" fill="url(#cup)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <rect x="{450 + gap - cw / 2}" y="418" width="{cw}" height="{ch}" rx="{cw * 0.44:.0f}" fill="url(#cup)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <!-- ear pads -->
    <rect x="{450 - gap - cw / 2 + 17}" y="437" width="{cw - 34}" height="{ch - 38}"
          rx="{(cw - 34) * 0.44:.0f}" fill="{p.deep}"/>
    <rect x="{450 + gap - cw / 2 + 17}" y="437" width="{cw - 34}" height="{ch - 38}"
          rx="{(cw - 34) * 0.44:.0f}" fill="{p.deep}"/>
    <ellipse cx="{450 - gap}" cy="512" rx="{cw * 0.24:.0f}" ry="{ch * 0.26:.0f}" fill="{p.trim}" opacity="0.7"/>
    <ellipse cx="{450 + gap}" cy="512" rx="{cw * 0.24:.0f}" ry="{ch * 0.26:.0f}" fill="{p.trim}" opacity="0.7"/>
    <!-- highlight -->
    <path d="M {450 - gap - cw / 2 + 20} 470 q 14 -34 46 -40" stroke="{p.light}" stroke-width="9"
          fill="none" stroke-linecap="round" opacity="0.55"/>
  </g>"""


def onear_front(p):
    return overear_front(p, pad_ratio=0.80)


def openback_front(p):
    """Same architecture, but the cups are grilles rather than sealed shells."""
    gap = 200
    cw, ch = 158, 172
    dots = "".join(
        f'<circle cx="{450 - gap - 40 + (i % 5) * 20}" cy="{452 + (i // 5) * 20}" r="5.4" fill="{p.deep}" opacity="0.85"/>'
        f'<circle cx="{450 + gap - 40 + (i % 5) * 20}" cy="{452 + (i // 5) * 20}" r="5.4" fill="{p.deep}" opacity="0.85"/>'
        for i in range(25)
    )
    return f"""  <g>
{_headband(p, gap, thickness=26)}
    <rect x="{450 - gap - 12}" y="348" width="24" height="86" rx="12" fill="{p.trim}"/>
    <rect x="{450 + gap - 12}" y="348" width="24" height="86" rx="12" fill="{p.trim}"/>
    <rect x="{450 - gap - cw / 2}" y="418" width="{cw}" height="{ch}" rx="24" fill="url(#cup)"/>
    <rect x="{450 + gap - cw / 2}" y="418" width="{cw}" height="{ch}" rx="24" fill="url(#cup)"/>
    <rect x="{450 - gap - cw / 2 + 16}" y="434" width="{cw - 32}" height="{ch - 32}" rx="14" fill="{p.dark}"/>
    <rect x="{450 + gap - cw / 2 + 16}" y="434" width="{cw - 32}" height="{ch - 32}" rx="14" fill="{p.dark}"/>
    {dots}
  </g>"""


def overear_quarter(p):
    return f"""  <g>
    <path d="M 300 250 C 300 140, 560 150, 606 330" fill="none" stroke="{p.deep}"
          stroke-width="30" stroke-linecap="round"/>
    <path d="M 300 250 C 300 140, 560 150, 606 330" fill="none" stroke="{p.light}"
          stroke-width="9" stroke-linecap="round" opacity="0.5"/>
    <rect x="590" y="300" width="26" height="80" rx="13" fill="{p.trim}"/>
    <ellipse cx="380" cy="470" rx="150" ry="168" fill="url(#cup)"/>
    <ellipse cx="380" cy="470" rx="112" ry="128" fill="{p.deep}"/>
    <ellipse cx="380" cy="470" rx="70" ry="84" fill="{p.trim}" opacity="0.75"/>
    <path d="M 300 380 q 34 -44 88 -52" stroke="{p.light}" stroke-width="11" fill="none"
          stroke-linecap="round" opacity="0.5"/>
    <ellipse cx="600" cy="460" rx="72" ry="126" fill="{p.dark}"/>
    <ellipse cx="600" cy="460" rx="48" ry="98" fill="{p.deep}"/>
  </g>"""


def overear_detail(p):
    rings = "".join(
        f'<circle cx="450" cy="430" r="{r}" fill="none" stroke="{p.trim}" stroke-width="3" opacity="0.5"/>'
        for r in range(60, 150, 18)
    )
    return f"""  <g>
    <ellipse cx="450" cy="430" rx="300" ry="320" fill="url(#cup)"/>
    <ellipse cx="450" cy="430" rx="232" ry="250" fill="{p.deep}"/>
    <ellipse cx="450" cy="430" rx="176" ry="192" fill="{p.dark}"/>
    {rings}
    <circle cx="450" cy="430" r="34" fill="{p.trim}"/>
    <path d="M 270 300 q 60 -78 168 -96" stroke="{p.light}" stroke-width="16" fill="none"
          stroke-linecap="round" opacity="0.45"/>
  </g>"""


def earbuds_case(p):
    """Charging case with one bud resting beside it."""
    return f"""  <g>
    <rect x="150" y="430" width="300" height="230" rx="56" fill="url(#body)"/>
    <path d="M 150 500 h 300" stroke="{p.trim}" stroke-width="5" opacity="0.7"/>
    <rect x="186" y="556" width="228" height="62" rx="24" fill="{p.deep}" opacity="0.55"/>
    <circle cx="300" cy="636" r="9" fill="{p.trim}"/>
    <g transform="translate(620,400) rotate(8)">
      <path d="M -34 58 q 34 26 68 0 l 14 150 q -48 26 -96 0 z" fill="url(#bodyV)"
            stroke="{p.outline}" stroke-width="{p.outline_width}"/>
      <rect x="-18" y="186" width="36" height="20" rx="10" fill="{p.trim}"/>
      <ellipse cx="0" cy="-2" rx="92" ry="80" fill="url(#cup)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
      <ellipse cx="4" cy="4" rx="52" ry="44" fill="{p.deep}"/>
      <ellipse cx="-28" cy="-28" rx="26" ry="18" fill="{p.light}" opacity="0.55" transform="rotate(-24)"/>
    </g>
  </g>"""


def earbuds_pair(p):
    def bud(x, flip=1):
        return f"""    <g transform="translate({x},380) scale({flip},1) rotate(6)">
      <path d="M -36 62 q 36 28 72 0 l 15 158 q -51 28 -102 0 z" fill="url(#bodyV)"
            stroke="{p.outline}" stroke-width="{p.outline_width}"/>
      <rect x="-19" y="196" width="38" height="21" rx="10" fill="{p.trim}"/>
      <ellipse cx="0" cy="-2" rx="98" ry="86" fill="url(#cup)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
      <ellipse cx="5" cy="5" rx="56" ry="48" fill="{p.deep}"/>
      <ellipse cx="-30" cy="-30" rx="28" ry="19" fill="{p.light}" opacity="0.55"/>
    </g>"""
    return "  <g>\n" + bud(290, -1) + "\n" + bud(610, 1) + "\n  </g>"


def earbuds_detail(p):
    return f"""  <g>
    <ellipse cx="450" cy="400" rx="290" ry="280" fill="url(#cup)"/>
    <ellipse cx="450" cy="400" rx="196" ry="190" fill="{p.deep}"/>
    <ellipse cx="450" cy="400" rx="120" ry="116" fill="{p.dark}"/>
    <ellipse cx="380" cy="320" rx="62" ry="46" fill="{p.light}" opacity="0.45"/>
    <path d="M 370 596 q 80 62 160 0 l 22 150 q -102 54 -204 0 z" fill="url(#bodyV)"/>
  </g>"""


# ---------------------------------------------------------------------------
# clothing
# ---------------------------------------------------------------------------

def _body_path(neck, hem=690):
    """Shared torso outline. `neck` closes the top edge."""
    return (f"M 318 214 L 244 258 L 172 402 L 264 458 L 292 396 L 292 {hem} "
            f"L 608 {hem} L 608 396 L 636 458 L 728 402 L 656 258 L 582 214 {neck} Z")


def _sleeves(p, long=False):
    if long:
        return f"""    <path d="M 244 258 L 172 402 L 196 560 L 292 548 L 292 396 Z" fill="url(#sleeve)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <path d="M 656 258 L 728 402 L 704 560 L 608 548 L 608 396 Z" fill="url(#sleeve)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>"""
    return f"""    <path d="M 244 258 L 172 402 L 264 458 L 292 396 Z" fill="url(#sleeve)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <path d="M 656 258 L 728 402 L 636 458 L 608 396 Z" fill="url(#sleeve)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>"""


def tee_front(p):
    neck = "L 512 214 A 66 48 0 0 1 388 214"
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p)}
    <path d="M 388 214 A 66 48 0 0 0 512 214" fill="none" stroke="{p.trim}" stroke-width="15"/>
    <path d="M 292 662 L 608 662" stroke="{p.dark}" stroke-width="4" opacity="0.6"/>
    <path d="M 340 300 q 24 180 -6 360" stroke="{p.dark}" stroke-width="7" fill="none" opacity="0.28"/>
    <path d="M 566 320 q -20 170 4 340" stroke="{p.dark}" stroke-width="6" fill="none" opacity="0.22"/>
  </g>"""


def tee_back(p):
    neck = "L 512 224 A 64 26 0 0 1 388 224"
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p)}
    <path d="M 388 224 A 64 26 0 0 0 512 224" fill="none" stroke="{p.trim}" stroke-width="13"/>
    <rect x="428" y="252" width="44" height="54" rx="8" fill="{p.light}" opacity="0.75"/>
    <path d="M 292 662 L 608 662" stroke="{p.dark}" stroke-width="4" opacity="0.6"/>
  </g>"""


def shirt_front(p):
    neck = "L 512 214 L 450 292 L 388 214"
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p, long=True)}
    <!-- placket -->
    <rect x="422" y="270" width="56" height="{690 - 270}" fill="{p.light}" opacity="0.55"/>
    <path d="M 450 270 L 450 690" stroke="{p.trim}" stroke-width="3" opacity="0.8"/>
    <!-- collar -->
    <path d="M 388 214 L 450 300 L 410 336 L 356 246 Z" fill="{p.light}"/>
    <path d="M 512 214 L 450 300 L 490 336 L 544 246 Z" fill="{p.dark}"/>
    <path d="M 388 214 L 450 300 L 512 214" fill="none" stroke="{p.trim}" stroke-width="4"/>
    <circle cx="450" cy="378" r="9" fill="{p.trim}"/>
    <circle cx="450" cy="468" r="9" fill="{p.trim}"/>
    <circle cx="450" cy="558" r="9" fill="{p.trim}"/>
    <circle cx="450" cy="648" r="9" fill="{p.trim}"/>
    <!-- cuffs -->
    <rect x="188" y="528" width="112" height="34" rx="8" fill="{p.dark}"/>
    <rect x="600" y="528" width="112" height="34" rx="8" fill="{p.dark}"/>
  </g>"""


def camp_shirt_front(p):
    """Open camp collar and a patch pocket — visibly not the oxford."""
    neck = "L 512 214 L 450 306 L 388 214"
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p)}
    <path d="M 388 214 L 450 306 L 392 352 L 340 236 Z" fill="{p.light}"/>
    <path d="M 512 214 L 450 306 L 508 352 L 560 236 Z" fill="{p.dark}"/>
    <path d="M 450 306 L 450 690" stroke="{p.trim}" stroke-width="3" opacity="0.7"/>
    <rect x="316" y="386" width="96" height="104" rx="6" fill="{p.dark}" opacity="0.55"/>
    <path d="M 316 408 L 412 408" stroke="{p.trim}" stroke-width="4" opacity="0.7"/>
    <circle cx="450" cy="440" r="8" fill="{p.trim}"/>
    <circle cx="450" cy="540" r="8" fill="{p.trim}"/>
    <circle cx="450" cy="640" r="8" fill="{p.trim}"/>
  </g>"""


def sweater_front(p):
    neck = "L 512 214 A 68 44 0 0 1 388 214"
    ribs = "".join(
        f'<path d="M {x} 636 L {x} 690" stroke="{p.trim}" stroke-width="4" opacity="0.45"/>'
        for x in range(306, 606, 22)
    )
    knit = "".join(
        f'<path d="M 320 {y} q 130 16 260 0" stroke="{p.dark}" stroke-width="3.5" fill="none" opacity="0.22"/>'
        for y in range(330, 630, 34)
    )
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p, long=True)}
    {knit}
    <path d="M 388 214 A 68 44 0 0 0 512 214" fill="none" stroke="{p.trim}" stroke-width="30"/>
    <rect x="292" y="636" width="316" height="54" fill="{p.dark}" opacity="0.75"/>
    {ribs}
    <rect x="188" y="520" width="112" height="44" rx="10" fill="{p.dark}"/>
    <rect x="600" y="520" width="112" height="44" rx="10" fill="{p.dark}"/>
  </g>"""


def fleece_front(p):
    neck = "L 512 196 L 450 240 L 388 196"
    grid_v = "".join(
        f'<path d="M {x} 300 L {x} 660" stroke="{p.dark}" stroke-width="2.5" opacity="0.18"/>'
        for x in range(312, 600, 26)
    )
    grid_h = "".join(
        f'<path d="M 300 {y} L 600 {y}" stroke="{p.dark}" stroke-width="2.5" opacity="0.18"/>'
        for y in range(320, 660, 26)
    )
    return f"""  <g>
    <path d="{_body_path(neck)}" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
{_sleeves(p, long=True)}
    {grid_v}{grid_h}
    <!-- stand collar and quarter zip -->
    <path d="M 388 196 L 512 196 L 512 150 L 388 150 Z" fill="{p.deep}"/>
    <path d="M 388 196 L 450 240 L 512 196" fill="{p.dark}"/>
    <rect x="440" y="150" width="20" height="300" rx="9" fill="{p.trim}"/>
    <rect x="434" y="430" width="32" height="46" rx="10" fill="{p.deep}"/>
    <rect x="292" y="648" width="316" height="42" fill="{p.dark}" opacity="0.7"/>
    <rect x="188" y="520" width="112" height="42" rx="10" fill="{p.dark}"/>
    <rect x="600" y="520" width="112" height="42" rx="10" fill="{p.dark}"/>
  </g>"""


def trousers_front(p):
    return f"""  <g>
    <path d="M 316 186 L 584 186 L 600 336 L 578 742 L 474 742 L 450 404 L 426 742 L 322 742 L 300 336 Z"
          fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <path d="M 316 186 L 584 186 L 588 244 L 312 244 Z" fill="{p.dark}"/>
    <path d="M 312 226 h 276" stroke="{p.trim}" stroke-width="4" opacity="0.7"/>
    <!-- belt loops -->
    <rect x="336" y="182" width="16" height="42" rx="5" fill="{p.deep}"/>
    <rect x="442" y="182" width="16" height="42" rx="5" fill="{p.deep}"/>
    <rect x="548" y="182" width="16" height="42" rx="5" fill="{p.deep}"/>
    <!-- fly -->
    <path d="M 450 244 L 450 330" stroke="{p.trim}" stroke-width="5" opacity="0.8"/>
    <path d="M 450 244 q 26 40 8 92" stroke="{p.trim}" stroke-width="4" fill="none" opacity="0.6"/>
    <!-- slant pockets -->
    <path d="M 322 262 L 372 330" stroke="{p.trim}" stroke-width="5" opacity="0.7"/>
    <path d="M 578 262 L 528 330" stroke="{p.trim}" stroke-width="5" opacity="0.7"/>
    <!-- creases -->
    <path d="M 384 350 L 372 730" stroke="{p.light}" stroke-width="5" opacity="0.4"/>
    <path d="M 516 350 L 528 730" stroke="{p.light}" stroke-width="5" opacity="0.4"/>
    <circle cx="450" cy="212" r="9" fill="{p.trim}"/>
  </g>"""


def trousers_back(p):
    return f"""  <g>
    <path d="M 316 186 L 584 186 L 600 336 L 578 742 L 474 742 L 450 404 L 426 742 L 322 742 L 300 336 Z"
          fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    <path d="M 316 186 L 584 186 L 588 238 L 312 238 Z" fill="{p.dark}"/>
    <rect x="336" y="272" width="96" height="64" rx="6" fill="{p.deep}" opacity="0.6"/>
    <rect x="468" y="272" width="96" height="64" rx="6" fill="{p.deep}" opacity="0.6"/>
    <path d="M 336 292 h 96 M 468 292 h 96" stroke="{p.trim}" stroke-width="4" opacity="0.7"/>
    <path d="M 450 238 L 450 404" stroke="{p.trim}" stroke-width="4" opacity="0.6"/>
  </g>"""


def collar_detail(p):
    """Close crop of the neckline and fabric — reads as a material shot."""
    weave = "".join(
        f'<path d="M {x} 120 L {x} 780" stroke="{p.dark}" stroke-width="4" opacity="0.14"/>'
        for x in range(170, 740, 26)
    ) + "".join(
        f'<path d="M 150 {y} L 750 {y}" stroke="{p.dark}" stroke-width="4" opacity="0.14"/>'
        for y in range(140, 790, 26)
    )
    return f"""  <g>
    <rect x="150" y="120" width="600" height="660" rx="26" fill="url(#body)" stroke="{p.outline}" stroke-width="{p.outline_width}"/>
    {weave}
    <path d="M 150 420 q 150 150 300 150 q 150 0 300 -150" fill="{p.dark}" opacity="0.30"/>
    <path d="M 150 420 q 150 150 300 150 q 150 0 300 -150" fill="none" stroke="{p.trim}" stroke-width="18"/>
    <rect x="150" y="120" width="600" height="660" rx="26" fill="none" stroke="{p.trim}"
          stroke-width="6" opacity="0.5"/>
  </g>"""


SILHOUETTES = {
    "overear": [overear_front, overear_quarter, overear_detail],
    "onear": [onear_front, overear_quarter, overear_detail],
    "openback": [openback_front, overear_quarter, overear_detail],
    "earbuds": [earbuds_case, earbuds_pair, earbuds_detail],
    "tee": [tee_front, tee_back, collar_detail],
    "shirt": [shirt_front, tee_back, collar_detail],
    "campshirt": [camp_shirt_front, tee_back, collar_detail],
    "sweater": [sweater_front, tee_back, collar_detail],
    "fleece": [fleece_front, tee_back, collar_detail],
    "trousers": [trousers_front, trousers_back, collar_detail],
}

SHADOWS = {
    "trousers": (450, 770, 190, 26),
    "earbuds": (450, 730, 230, 30),
}

# slug -> (silhouette, {colour id: hex}) — colour ids match demo-data.ts
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
    "coastline-linen-shirt": ("campshirt", {"natural": "#ded4c2", "indigo": "#38455f"}),
    "rampart-chino": ("trousers", {"khaki": "#bfa781", "navy": "#2c3752", "black": "#242529"}),
    "summit-quarter-zip": ("fleece", {"slate": "#5a6472", "moss": "#586b4c"}),
}


def main():
    written = 0
    for slug, (kind, colours) in PRODUCTS.items():
        folder = os.path.join(OUT, slug)
        os.makedirs(folder, exist_ok=True)
        shadow = SHADOWS.get(kind, (450, 760, 250, 34))
        for colour_id, hexv in colours.items():
            palette = Palette(hexv)
            for i, render in enumerate(SILHOUETTES[kind], start=1):
                svg = frame(palette, render(palette), shadow=shadow)
                path = os.path.join(folder, "%s-%d.svg" % (colour_id, i))
                io.open(path, "w", encoding="utf-8").write(svg)
                written += 1
    print("wrote %d images across %d products" % (written, len(PRODUCTS)))


if __name__ == "__main__":
    main()
