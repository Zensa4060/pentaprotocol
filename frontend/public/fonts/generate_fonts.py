#!/usr/bin/env python3
"""
PentaProtocol Custom Font Generator
Creates two TTF fonts:
  • PentaPixel  – clean 5×7 dot-matrix pixel font (full ASCII)
  • PentaOrbit  – geometric modular space font (full ASCII)

Run:  pip install fonttools && python generate_fonts.py
"""
import math, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

OUT = os.path.dirname(os.path.abspath(__file__))

# ─── Drawing helpers ──────────────────────────────────────────────────────────

def _poly(pen, pts):
    """Draw one closed polygon (CCW in y-up TrueType coords)."""
    if len(pts) < 3: return
    pen.moveTo(pts[0])
    for p in pts[1:]: pen.lineTo(p)
    pen.closePath()

def R(x0, y0, x1, y1):
    """Axis-aligned rectangle → CCW polygon."""
    return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]

def D(x1, y1, x2, y2, sw):
    """Diagonal stroke from (x1,y1) to (x2,y2) with width sw → CCW polygon."""
    dx=x2-x1; dy=y2-y1
    ln=math.sqrt(dx*dx+dy*dy)
    if ln<1: return None
    px=int(round(-dy/ln*sw/2)); py=int(round(dx/ln*sw/2))
    return [(x1-px,y1-py),(x2-px,y2-py),(x2+px,y2+py),(x1+px,y1+py)]

def draw_glyph(pen, shapes):
    for s in shapes:
        if s: _poly(pen, s)

def build(family, style, upm, asc, dsc, cap_h, x_h, glyphs_data, output):
    """
    glyphs_data: dict  name|codepoint → (advance_width, draw_fn | None)
    draw_fn: callable(pen) → None
    """
    cmap = {}
    named = {}

    for key, (adv, fn) in glyphs_data.items():
        if isinstance(key, int):
            cp = key
            if 0x41 <= cp <= 0x5A:  name = chr(cp)
            elif 0x61 <= cp <= 0x7A: name = chr(cp)
            elif 0x30 <= cp <= 0x39: name = chr(cp)
            else:
                _N = {0x20:'space',0x21:'exclam',0x22:'quotedbl',0x23:'numbersign',
                      0x24:'dollar',0x25:'percent',0x26:'ampersand',0x27:'quotesingle',
                      0x28:'parenleft',0x29:'parenright',0x2A:'asterisk',0x2B:'plus',
                      0x2C:'comma',0x2D:'hyphen',0x2E:'period',0x2F:'slash',
                      0x3A:'colon',0x3B:'semicolon',0x3C:'less',0x3D:'equal',
                      0x3E:'greater',0x3F:'question',0x40:'at',
                      0x5B:'bracketleft',0x5C:'backslash',0x5D:'bracketright',
                      0x5E:'asciicircum',0x5F:'underscore',0x60:'grave',
                      0x7B:'braceleft',0x7C:'bar',0x7D:'braceright',0x7E:'asciitilde'}
                name = _N.get(cp, f'uni{cp:04X}')
            cmap[cp] = name
        else:
            name = key
        named[name] = (adv, fn)

    order = ['.notdef'] + [n for n in named if n != '.notdef']
    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)

    glyph_objs = {}
    metrics = {}
    for name in order:
        adv, fn = named.get(name, (500, None))
        pen = TTGlyphPen(None)
        if fn: fn(pen)
        glyph_objs[name] = pen.glyph()
        metrics[name] = (adv, 0)

    fb.setupGlyf(glyph_objs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=asc, descent=dsc)
    fb.setupNameTable({'familyName': family, 'styleName': style,
                       'fullName': f'{family} {style}', 'version': 'Version 1.000',
                       'psName': f'{family}-{style}'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=dsc, sTypoLineGap=0,
                usWinAscent=asc, usWinDescent=-dsc,
                sxHeight=x_h, sCapHeight=cap_h, achVendID='PNTA', fsType=0,
                ulUnicodeRange1=0b1)
    fb.setupPost()
    fb.setupHead(unitsPerEm=upm)
    path = os.path.join(OUT, output)
    fb.font.save(path)
    print(f'  ✓  {path}')


# ═══════════════════════════════════════════════════════════════════════════════
#  PENTAPIXEL  –  5 × 7 dot-matrix bitmap font
# ═══════════════════════════════════════════════════════════════════════════════
# CELL = 90 units square, PITCH = 110 (20-unit gap between dots)
# 7 rows × 110 = 770 — scaled so cap height = 700
# Scale factor = 700/770 ≈ 0.9091

PP_SCALE  = 700 / 770       # ≈ 0.9091
PP_CELL   = 90              # logical cell before scale
PP_PITCH  = 110             # logical pitch before scale
PP_COLS   = 5
PP_ROWS   = 7
PP_LPAD   = 30              # left side bearing (logical)
PP_ADV    = round((PP_COLS * PP_PITCH + PP_LPAD + 30) * PP_SCALE)  # ≈ 545

def _pp_row_y(row):
    """Return (y_bottom, y_top) in scaled units for a given row (0=top)."""
    y_bot_log = (PP_ROWS - 1 - row) * PP_PITCH
    y_top_log = y_bot_log + PP_CELL
    return (round(y_bot_log * PP_SCALE), round(y_top_log * PP_SCALE))

def _pp_col_x(col):
    """Return (x_left, x_right) in scaled units for a given col."""
    x_l = round((PP_LPAD + col * PP_PITCH) * PP_SCALE)
    x_r = round((PP_LPAD + col * PP_PITCH + PP_CELL) * PP_SCALE)
    return (x_l, x_r)

def pp_draw(bitmap):
    """
    bitmap: list of ≥7 strings, each 5 chars '0'/'1'.
    Rows 0..6 = baseline area (row 6 bottom ≈ y=0).
    Rows 7..8 (optional) = descender area (below baseline).
    """
    def fn(pen):
        for r, row in enumerate(bitmap):
            if r < PP_ROWS:
                yb, yt = _pp_row_y(r)
            else:
                # Descender rows: shift below baseline
                drop = (r - PP_ROWS + 1) * PP_PITCH
                yb = round(-drop * PP_SCALE)
                yt = round((-drop + PP_CELL) * PP_SCALE)
            for c, bit in enumerate(row):
                if bit == '1':
                    xl, xr = _pp_col_x(c)
                    _poly(pen, R(xl, yb, xr, yt))
    return fn

# ── Pixel bitmaps (5-wide × 7-tall, row 0 = top) ─────────────────────────────
# Classic 5×7 dot-matrix character set, battle-tested for readability.
BMP = {
    # Uppercase A–Z
    'A':["01110","10001","10001","11111","10001","10001","10001"],
    'B':["11110","10001","10001","11110","10001","10001","11110"],
    'C':["01110","10001","10000","10000","10000","10001","01110"],
    'D':["11100","10010","10001","10001","10001","10010","11100"],
    'E':["11111","10000","10000","11110","10000","10000","11111"],
    'F':["11111","10000","10000","11110","10000","10000","10000"],
    'G':["01110","10001","10000","10111","10001","10001","01110"],
    'H':["10001","10001","10001","11111","10001","10001","10001"],
    'I':["01110","00100","00100","00100","00100","00100","01110"],
    'J':["00111","00010","00010","00010","10010","10010","01100"],
    'K':["10001","10010","10100","11000","10100","10010","10001"],
    'L':["10000","10000","10000","10000","10000","10000","11111"],
    'M':["10001","11011","10101","10001","10001","10001","10001"],
    'N':["10001","11001","10101","10011","10001","10001","10001"],
    'O':["01110","10001","10001","10001","10001","10001","01110"],
    'P':["11110","10001","10001","11110","10000","10000","10000"],
    'Q':["01110","10001","10001","10001","10101","10010","01101"],
    'R':["11110","10001","10001","11110","10100","10010","10001"],
    'S':["01111","10000","10000","01110","00001","00001","11110"],
    'T':["11111","00100","00100","00100","00100","00100","00100"],
    'U':["10001","10001","10001","10001","10001","10001","01110"],
    'V':["10001","10001","10001","10001","01010","01010","00100"],
    'W':["10001","10001","10001","10101","10101","11011","10001"],
    'X':["10001","10001","01010","00100","01010","10001","10001"],
    'Y':["10001","10001","01010","00100","00100","00100","00100"],
    'Z':["11111","00001","00010","00100","01000","10000","11111"],
    # Lowercase a–z
    'a':["00000","01110","00001","01111","10001","10011","01101"],
    'b':["10000","10000","10110","11001","10001","10001","11110"],
    'c':["00000","00000","01110","10001","10000","10001","01110"],
    'd':["00001","00001","01101","10011","10001","10001","01111"],
    'e':["00000","00000","01110","10001","11111","10000","01110"],
    'f':["00110","01001","01000","11100","01000","01000","01000"],
    'g':["00000","01111","10001","10001","01111","00001","01110"],
    'h':["10000","10000","10110","11001","10001","10001","10001"],
    'i':["00100","00000","01100","00100","00100","00100","01110"],
    'j':["00010","00000","00110","00010","00010","10010","01100"],
    'k':["10000","10010","10100","11000","10100","10010","10001"],
    'l':["01100","00100","00100","00100","00100","00100","01110"],
    'm':["00000","00000","11010","10101","10101","10001","10001"],
    'n':["00000","00000","10110","11001","10001","10001","10001"],
    'o':["00000","00000","01110","10001","10001","10001","01110"],
    'p':["00000","11110","10001","10001","11110","10000","10000"],
    'q':["00000","01111","10001","10001","01111","00001","00001"],
    'r':["00000","00000","10110","11001","10000","10000","10000"],
    's':["00000","00000","01111","10000","01110","00001","11110"],
    't':["01000","01000","11110","01000","01000","01001","00110"],
    'u':["00000","00000","10001","10001","10001","10011","01101"],
    'v':["00000","00000","10001","10001","01010","01010","00100"],
    'w':["00000","00000","10001","10101","10101","01010","01010"],
    'x':["00000","00000","10001","01010","00100","01010","10001"],
    'y':["00000","10001","10001","01111","00001","10001","01110"],
    'z':["00000","00000","11111","00010","00100","01000","11111"],
    # Digits 0–9
    '0':["01110","10001","10011","10101","11001","10001","01110"],
    '1':["00100","01100","00100","00100","00100","00100","01110"],
    '2':["01110","10001","00001","00110","01000","10000","11111"],
    '3':["11110","00001","00001","01110","00001","00001","11110"],
    '4':["00010","00110","01010","10010","11111","00010","00010"],
    '5':["11111","10000","10000","11110","00001","00001","11110"],
    '6':["01110","10000","10000","11110","10001","10001","01110"],
    '7':["11111","00001","00010","00100","01000","01000","01000"],
    '8':["01110","10001","10001","01110","10001","10001","01110"],
    '9':["01110","10001","10001","01111","00001","00001","01110"],
    # Punctuation & symbols
    ' ':["00000","00000","00000","00000","00000","00000","00000"],
    '!':["00100","00100","00100","00100","00100","00000","00100"],
    '"':["01010","01010","00000","00000","00000","00000","00000"],
    '#':["01010","01010","11111","01010","11111","01010","01010"],
    '$':["00100","01111","10100","01110","00101","11110","00100"],
    '%':["11000","11001","00010","00100","01000","10011","00011"],
    '&':["01100","10010","10100","01000","10101","10010","01101"],
    "'":["01100","01100","01000","00000","00000","00000","00000"],
    '(':["00010","00100","01000","01000","01000","00100","00010"],
    ')':["01000","00100","00010","00010","00010","00100","01000"],
    '*':["00000","00100","10101","01110","10101","00100","00000"],
    '+':["00000","00100","00100","11111","00100","00100","00000"],
    ',':["00000","00000","00000","01100","01100","00100","01000"],
    '-':["00000","00000","00000","11111","00000","00000","00000"],
    '.':["00000","00000","00000","00000","00000","01100","01100"],
    '/':["00001","00010","00100","00100","01000","10000","10000"],
    ':':["00000","01100","01100","00000","01100","01100","00000"],
    ';':["00000","01100","01100","00000","01100","00100","01000"],
    '<':["00010","00100","01000","10000","01000","00100","00010"],
    '=':["00000","00000","11111","00000","11111","00000","00000"],
    '>':["01000","00100","00010","00001","00010","00100","01000"],
    '?':["01110","10001","00001","00110","00100","00000","00100"],
    '@':["01110","10001","10001","10111","10101","10000","01110"],
    '[':["01110","01000","01000","01000","01000","01000","01110"],
   '\\':["10000","10000","01000","00100","00010","00001","00001"],
    ']':["01110","00010","00010","00010","00010","00010","01110"],
    '^':["00100","01010","10001","00000","00000","00000","00000"],
    '_':["00000","00000","00000","00000","00000","00000","11111"],
    '`':["01000","00100","00010","00000","00000","00000","00000"],
    '{':["00110","01000","01000","11000","01000","01000","00110"],
    '|':["00100","00100","00100","00100","00100","00100","00100"],
    '}':["01100","00010","00010","00011","00010","00010","01100"],
    '~':["00000","01000","10101","00010","00000","00000","00000"],
}

def _pp_notdef(pen):
    """Dotted rectangle placeholder."""
    for pts in [R(50,0,480,80),R(50,620,480,700),R(50,0,130,700),R(400,0,480,700)]:
        _poly(pen, pts)

def make_pentapixel():
    gd = {'.notdef': (PP_ADV, _pp_notdef)}
    for char, bm in BMP.items():
        cp = ord(char)
        gd[cp] = (PP_ADV if char != ' ' else round(PP_ADV * 0.7), pp_draw(bm))
    build('PentaPixel','Regular',800,700,-200,700,490,gd,'PentaPixel-Regular.ttf')


# ═══════════════════════════════════════════════════════════════════════════════
#  PENTAORBIT  –  geometric modular space font
# ═══════════════════════════════════════════════════════════════════════════════
# Uppercase: width W=480, cap-height H=700, stroke SW=72
# Lowercase: width WL=420, x-height XH=490, same stroke
# Digits share uppercase proportions.  Descenders reach -180.

W=480; H=700; SW=72
MH=(H-SW)//2   # 314  mid-bar lower y
MC=MH+SW       # 386  mid-bar upper y
TS=H-SW        # 628  top-stroke lower y
SH=SW//2       # 36   half-stroke
ADV=560        # uppercase advance

# Lowercase
XH=490; WL=420
MHL=(XH-SW)//2  # 209
MCL=MHL+SW      # 281
TSL=XH-SW       # 418
SHL=SH
ADV_L=520; ADV_N=320; ADV_W=720

# ─── Uppercase glyphs ─────────────────────────────────────────────────────────
# A: tent shape (two diagonal legs) + crossbar — clearly an A
def po_A(p): draw_glyph(p,[
    D(0,0,W//2,H,SW), D(W//2,H,W,0,SW),    # left & right diagonal legs
    R(W//5,MH,W*4//5,MC),                   # crossbar
])
# B: left bar + 3 horizontals + 2 right half-bars
def po_B(p): draw_glyph(p,[
    R(0,0,SW,H), R(SW,TS,W-SW,H), R(SW,MH,W-SW,MC), R(SW,0,W-SW,SW),
    R(W-SW,MH,W,H), R(W-SW,0,W,MC),
])
# C: left bar + top + bottom (open right)
def po_C(p): draw_glyph(p,[R(0,0,SW,H), R(0,TS,W,H), R(0,0,W,SW)])
# D: left bar (2× wide = flat side) + inset top/bottom + right bar
def po_D(p): draw_glyph(p,[
    R(0,0,SW*2,H),               # wide flat left
    R(SW,TS,W-SW,H), R(SW,0,W-SW,SW),
    R(W-SW,SW,W,TS),
])
# E: left + top + mid(¾) + bottom
def po_E(p): draw_glyph(p,[R(0,0,SW,H), R(0,TS,W,H), R(0,MH,W*3//4,MC), R(0,0,W,SW)])
# F: left + top + mid(¾)
def po_F(p): draw_glyph(p,[R(0,0,SW,H), R(0,TS,W,H), R(0,MH,W*3//4,MC)])
# G: C + lower-right bar + inner mid stub
def po_G(p): draw_glyph(p,[
    R(0,0,SW,H), R(0,TS,W,H), R(0,0,W,SW),
    R(W-SW,0,W,MC), R(W//2,MH,W,MC),
])
# H: left + right + crossbar
def po_H(p): draw_glyph(p,[R(0,0,SW,H), R(W-SW,0,W,H), R(0,MH,W,MC)])
# I: serif top + center stem + serif bottom
def po_I(p): draw_glyph(p,[R(0,TS,W,H), R(W//2-SH,0,W//2+SH,H), R(0,0,W,SW)])
# J: top bar + right bar (upper) + bottom + small left hook
def po_J(p): draw_glyph(p,[
    R(0,TS,W,H), R(W-SW,SW*2,W,TS), R(0,0,W,SW), R(0,SW,SW,SW*3),
])
# K: left bar + two diagonal arms meeting at mid
def po_K(p): draw_glyph(p,[
    R(0,0,SW,H),
    D(W//2,MC,W,H,SW),   # upper arm → top-right
    D(W//2,MH,W,0,SW),   # lower arm → bottom-right
])
# L: left bar + bottom
def po_L(p): draw_glyph(p,[R(0,0,SW,H), R(0,0,W,SW)])
# M: two outer bars + two inner diagonals forming the crown peaks
def po_M(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,0,W,H),
    D(SW//2,H,W//2,MH,SW),        # left inner: top-left → center-mid
    D(W//2,MH,W-SW//2,H,SW),      # right inner: center-mid → top-right
])
# N: left + right + diagonal from top-left to bottom-right
def po_N(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,0,W,H),
    D(SH,H,W-SH,0,SW),
])
# O: rect outline (symmetric)
def po_O(p): draw_glyph(p,[R(0,0,SW,H), R(W-SW,0,W,H), R(0,TS,W,H), R(0,0,W,SW)])
# P: left + top + mid + upper-right (no bottom)
def po_P(p): draw_glyph(p,[R(0,0,SW,H), R(0,TS,W,H), R(0,MH,W,MC), R(W-SW,MH,W,H)])
# Q: O + small tail bottom-right
def po_Q(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,0,W,H), R(0,TS,W,H), R(0,0,W,SW),
    R(W//2,0,W,SW+SH),
])
# R: P + diagonal leg going lower-right
def po_R(p): draw_glyph(p,[
    R(0,0,SW,H), R(0,TS,W,H), R(0,MH,W,MC), R(W-SW,MH,W,H),
    D(W//2,MH,W,0,SW),
])
# S: 3 bars + upper-left half + lower-right half
def po_S(p): draw_glyph(p,[
    R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW),
    R(0,MH,SW,H), R(W-SW,0,W,MC),
])
# T: top bar + center stem
def po_T(p): draw_glyph(p,[R(0,TS,W,H), R(W//2-SH,0,W//2+SH,H)])
# U: left + right + bottom (open top)
def po_U(p): draw_glyph(p,[R(0,0,SW,H), R(W-SW,0,W,H), R(0,0,W,SW)])
# V: two diagonal legs meeting at bottom-center
def po_V(p): draw_glyph(p,[D(0,H,W//2,0,SW), D(W//2,0,W,H,SW)])
# W: 4 zigzag diagonals
def po_W(p): draw_glyph(p,[
    D(0,H,W//4,0,SW), D(W//4,0,W//2,H//2,SW),
    D(W//2,H//2,W*3//4,0,SW), D(W*3//4,0,W,H,SW),
])
# X: two crossing diagonals
def po_X(p): draw_glyph(p,[D(0,0,W,H,SW), D(0,H,W,0,SW)])
# Y: two upper diagonals + center stem
def po_Y(p): draw_glyph(p,[
    D(0,H,W//2,H//2,SW), D(W,H,W//2,H//2,SW),
    R(W//2-SH,0,W//2+SH,H//2+SH),
])
# Z: top bar + diagonal + bottom bar
def po_Z(p): draw_glyph(p,[R(0,TS,W,H), D(W,H,0,0,SW), R(0,0,W,SW)])

UPPER_FNS = {'A':po_A,'B':po_B,'C':po_C,'D':po_D,'E':po_E,'F':po_F,'G':po_G,
             'H':po_H,'I':po_I,'J':po_J,'K':po_K,'L':po_L,'M':po_M,'N':po_N,
             'O':po_O,'P':po_P,'Q':po_Q,'R':po_R,'S':po_S,'T':po_T,'U':po_U,
             'V':po_V,'W':po_W,'X':po_X,'Y':po_Y,'Z':po_Z}

# ─── Lowercase glyphs (x-height XH=490, width WL=420) ────────────────────────
# a: right bar (full) + top + mid + bottom (open top-left)
def po_a(p): draw_glyph(p,[
    R(WL-SW,0,WL,XH), R(SW,TSL,WL,XH), R(0,MHL,WL,MCL), R(0,0,WL,SW), R(0,0,SW,MCL),
])
# b: full-height left bar + b-bowl on lower-right
def po_b(p): draw_glyph(p,[
    R(0,0,SW,H), R(SW,TSL,WL-SW,XH), R(SW,MHL,WL-SW,MCL),
    R(SW,0,WL-SW,SW), R(WL-SW,MHL,WL,XH), R(WL-SW,0,WL,MCL),
])
# c: left bar + top + bottom
def po_c(p): draw_glyph(p,[R(0,0,SW,XH), R(0,TSL,WL,XH), R(0,0,WL,SW)])
# d: right ascender bar + left bar (x-ht) + top + bottom
def po_d(p): draw_glyph(p,[
    R(WL-SW,0,WL,H), R(0,0,SW,XH), R(0,TSL,WL-SW,XH), R(0,0,WL-SW,SW),
])
# e: left + top + mid crossbar + bottom (mid closes right half = open bottom-right)
def po_e(p): draw_glyph(p,[
    R(0,0,SW,XH), R(0,TSL,WL,XH), R(0,MHL,WL,MCL), R(0,0,WL,SW),
])
# f: vertical bar (ascender) + top hook right + crossbar
def po_f(p): draw_glyph(p,[
    R(SH,0,SH+SW,H),
    R(SH,int(H*0.72),int(WL*0.72),int(H*0.72)+SW),
    R(0,MCL,int(WL*0.8),MCL+SW),
])
# g: o-shape (x-ht) + right bar descender + bottom of descender
def po_g(p): draw_glyph(p,[
    R(0,0,SW,XH), R(WL-SW,-180,WL,XH),
    R(0,TSL,WL,XH), R(0,0,WL,SW),
    R(0,-180,WL-SW,-180+SW),
])
# h: full-height left bar + n-shape arch at x-height
def po_h(p): draw_glyph(p,[
    R(0,0,SW,H), R(0,TSL,WL,XH), R(WL-SW,0,WL,TSL),
])
# i: short bar + dot above
def po_i(p):
    iw=SW*2; dy=XH+SW+SW//2
    draw_glyph(p,[R(0,0,iw,XH), R(0,dy,iw,dy+SW+SW//2)])
# j: bar + descender hook + dot
def po_j(p):
    iw=SW*2; dy=XH+SW+SW//2
    draw_glyph(p,[R(0,-160,iw,XH), R(-SH,-160,iw,-160+SW), R(0,dy,iw,dy+SW+SW//2)])
# k: full-height left bar + two diagonal arms
def po_k(p): draw_glyph(p,[
    R(0,0,SW,H), D(WL//2,MCL,WL,XH,SW), D(WL//2,MHL,WL,0,SW),
])
# l: bar (ascender) + bottom serif
def po_l(p): draw_glyph(p,[R(SH,0,SH+SW,H), R(0,0,SH*3,SW)])
# m: three bars + two arches
def po_m(p):
    WM=WL+WL//2; MX=WM//3
    draw_glyph(p,[
        R(0,0,SW,XH), R(MX-SH,0,MX+SH,XH), R(WM-SW,0,WM,XH),
        R(0,TSL,MX+SH,XH), R(MX-SH,TSL,WM,XH),
    ])
# n: left bar (x-ht) + arch (top bar + right bar)
def po_n(p): draw_glyph(p,[R(0,0,SW,XH), R(0,TSL,WL,XH), R(WL-SW,0,WL,TSL)])
# o: same as O at x-height
def po_o(p): draw_glyph(p,[R(0,0,SW,XH), R(WL-SW,0,WL,XH), R(0,TSL,WL,XH), R(0,0,WL,SW)])
# p: left descender bar + b-bowl shape
def po_p(p): draw_glyph(p,[
    R(0,-180,SW,XH), R(SW,TSL,WL-SW,XH), R(SW,MHL,WL-SW,MCL),
    R(SW,0,WL-SW,SW), R(WL-SW,MHL,WL,XH), R(WL-SW,0,WL,MCL),
])
# q: right descender bar + d-bowl shape (mirrored b)
def po_q(p): draw_glyph(p,[
    R(WL-SW,-180,WL,XH), R(0,TSL,WL-SW,XH), R(0,MHL,WL-SW,MCL),
    R(0,0,WL-SW,SW), R(0,MHL,SW,XH), R(0,0,SW,MCL),
])
# r: left bar (x-ht) + top hook right (no right bar going full down)
def po_r(p): draw_glyph(p,[R(0,0,SW,XH), R(0,TSL,WL,XH), R(WL-SW,TSL,WL,XH)])
# s: same structure as S at x-height
def po_s(p): draw_glyph(p,[
    R(0,TSL,WL,XH), R(0,MHL,WL,MCL), R(0,0,WL,SW),
    R(0,MHL,SW,XH), R(WL-SW,0,WL,MCL),
])
# t: bar (ascender height) + crossbar at ≈¾ x-height
def po_t(p): draw_glyph(p,[
    R(SH,0,SH+SW,H), R(0,int(XH*0.72),int(WL*0.85),int(XH*0.72)+SW),
])
# u: left + right + bottom (U at x-height)
def po_u(p): draw_glyph(p,[R(0,0,SW,XH), R(WL-SW,0,WL,XH), R(0,0,WL,SW)])
# v: two diagonal legs meeting at bottom-center
def po_v(p): draw_glyph(p,[D(0,XH,WL//2,0,SW), D(WL//2,0,WL,XH,SW)])
# w: 4 zigzag diagonals at x-height
def po_w(p):
    WW=int(WL*1.35)
    draw_glyph(p,[
        D(0,XH,WW//4,0,SW), D(WW//4,0,WW//2,XH//2,SW),
        D(WW//2,XH//2,WW*3//4,0,SW), D(WW*3//4,0,WW,XH,SW),
    ])
# x: two crossing diagonals at x-height
def po_x(p): draw_glyph(p,[D(0,0,WL,XH,SW), D(0,XH,WL,0,SW)])
# y: two upper diagonals + stem to descender
def po_y(p): draw_glyph(p,[
    D(0,XH,WL//2,XH//3,SW), D(WL,XH,WL//2,XH//3,SW),
    R(WL//2-SH,-180,WL//2+SH,XH//3+SH),
])
# z: top + diagonal + bottom at x-height
def po_z(p): draw_glyph(p,[R(0,TSL,WL,XH), D(WL,XH,0,0,SW), R(0,0,WL,SW)])

LOWER_FNS = {'a':po_a,'b':po_b,'c':po_c,'d':po_d,'e':po_e,'f':po_f,'g':po_g,
             'h':po_h,'i':po_i,'j':po_j,'k':po_k,'l':po_l,'m':po_m,'n':po_n,
             'o':po_o,'p':po_p,'q':po_q,'r':po_r,'s':po_s,'t':po_t,'u':po_u,
             'v':po_v,'w':po_w,'x':po_x,'y':po_y,'z':po_z}

# ─── Digits ───────────────────────────────────────────────────────────────────
# 0: rect + thin diagonal slash (distinct from O)
def po_0(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,0,W,H), R(0,TS,W,H), R(0,0,W,SW),
    D(W//5,SW,W*4//5,H-SW,SW//3),
])
# 1: main bar + angled top connector + bottom serif
def po_1(p): draw_glyph(p,[
    R(W//2-SH,0,W//2+SH,H),
    D(W//5,H-SW,W//2-SH,H,SW),
    R(W//8,0,W*7//8,SW),
])
# 2: top + upper-right + mid + lower-left + bottom
def po_2(p): draw_glyph(p,[
    R(0,TS,W,H), R(W-SW,MH,W,H), R(0,MH,W,MC), R(0,SW,SW,MH), R(0,0,W,SW),
])
# 3: top + upper-right + mid + lower-right + bottom
def po_3(p): draw_glyph(p,[
    R(0,TS,W,H), R(W-SW,MH,W,H), R(0,MH,W,MC), R(W-SW,0,W,MH), R(0,0,W,SW),
])
# 4: left-upper bar + crossbar + right bar (full)
def po_4(p): draw_glyph(p,[R(0,MH,W,MC), R(W-SW,0,W,H), R(0,MH,SW,H)])
# 5: top + upper-left + mid + lower-right + bottom
def po_5(p): draw_glyph(p,[
    R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW), R(0,MH,SW,H), R(W-SW,0,W,MC),
])
# 6: left bar (full) + top + mid + bottom + lower-right
def po_6(p): draw_glyph(p,[
    R(0,0,SW,H), R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW), R(W-SW,0,W,MC),
])
# 7: top bar + diagonal going lower-left
def po_7(p): draw_glyph(p,[R(0,TS,W,H), D(W,H,W//8,0,SW)])
# 8: O + mid bar
def po_8(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,0,W,H), R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW),
])
# 9: mirror of 6 — upper O + right descender
def po_9(p): draw_glyph(p,[
    R(0,MH,SW,H), R(W-SW,0,W,H), R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW),
])

DIGIT_FNS = {'0':po_0,'1':po_1,'2':po_2,'3':po_3,'4':po_4,
             '5':po_5,'6':po_6,'7':po_7,'8':po_8,'9':po_9}

# ─── Punctuation & symbols ────────────────────────────────────────────────────
HS=SH; QS=SW//4

def po_space(p): pass
def po_exclam(p): draw_glyph(p,[R(W//2-HS,SW*2,W//2+HS,H), R(W//2-HS,0,W//2+HS,SW+HS)])
def po_quotedbl(p): draw_glyph(p,[R(W//4-HS,TS,W//4+HS,H), R(W*3//4-HS,TS,W*3//4+HS,H)])
def po_numbersign(p): draw_glyph(p,[
    R(W//4-HS,0,W//4+HS,H), R(W*3//4-HS,0,W*3//4+HS,H),
    R(0,MH+SW//3,W,MH+SW//3+SW), R(0,MH-SW//3-SW,W,MH-SW//3),
])
def po_dollar(p): draw_glyph(p,[
    R(0,TS,W,H), R(0,MH,W,MC), R(0,0,W,SW),
    R(0,MH,SW,H), R(W-SW,0,W,MC), R(W//2-HS,-SW,W//2+HS,H+SW),
])
def po_percent(p): draw_glyph(p,[
    D(0,0,W,H,SW), R(0,int(H*0.6),int(W*0.32),H), R(int(W*0.68),0,W,int(H*0.4)),
])
def po_ampersand(p): draw_glyph(p,[
    R(0,MH,W,MC), R(0,TS,W*3//4,H), R(0,0,W*2//3,SW),
    R(0,MH,SW,H), D(W//3,MH,W,0,SW),
])
def po_quotesingle(p): draw_glyph(p,[R(W//2-HS,TS,W//2+HS,H)])
def po_parenleft(p): draw_glyph(p,[
    R(W*2//5,0,W*2//5+SW,H), R(W//5,SW,W*2//5+SW,SW*2), R(W//5,H-SW*2,W*2//5+SW,H),
])
def po_parenright(p): draw_glyph(p,[
    R(W//5,0,W//5+SW,H), R(W//5,SW,W*3//5,SW*2), R(W//5,H-SW*2,W*3//5,H),
])
def po_asterisk(p): draw_glyph(p,[
    R(W//2-HS,MH-SW,W//2+HS,MC+SW), R(0,MH,W,MC),
    D(W//6,MH-SW,W*5//6,MC+SW,SW), D(W//6,MC+SW,W*5//6,MH-SW,SW),
])
def po_plus(p): draw_glyph(p,[R(0,MH,W,MC), R(W//2-HS,SW*2,W//2+HS,H-SW*2)])
def po_comma(p): draw_glyph(p,[R(W//2-HS,0,W//2+HS,SW*2)])
def po_hyphen(p): draw_glyph(p,[R(W//8,MH,W*7//8,MC)])
def po_period(p): draw_glyph(p,[R(W//2-HS,0,W//2+HS,SW)])
def po_slash(p): draw_glyph(p,[D(0,0,W,H,SW)])
def po_colon(p): draw_glyph(p,[R(W//2-HS,0,W//2+HS,SW), R(W//2-HS,MH,W//2+HS,MC)])
def po_semicolon(p): draw_glyph(p,[R(W//2-HS,0,W//2+HS,SW*2), R(W//2-HS,MH,W//2+HS,MC)])
def po_less(p): draw_glyph(p,[D(W,H,SW,H//2,SW), D(SW,H//2,W,0,SW)])
def po_equal(p): draw_glyph(p,[R(W//8,MH-HS,W*7//8,MH+HS), R(W//8,MC-HS,W*7//8,MC+HS)])
def po_greater(p): draw_glyph(p,[D(0,H,W-SW,H//2,SW), D(W-SW,H//2,0,0,SW)])
def po_question(p): draw_glyph(p,[
    R(0,TS,W,H), R(W-SW,MH,W,H), R(0,MH,W,MC),
    R(W//2-HS,SW*2,W//2+HS,MC), R(W//2-HS,0,W//2+HS,SW),
])
def po_at(p): draw_glyph(p,[
    R(0,0,SW,H), R(W-SW,SW*2,W,H), R(0,TS,W,H), R(0,0,W-SW,SW),
    R(W//2,SW*3,W-SW,H-SW*3), R(W//2,MHL,W-SW,MCL),
])
def po_bracketleft(p): draw_glyph(p,[
    R(W//4,0,W//4+SW,H), R(W//4,TS,W*3//4,H), R(W//4,0,W*3//4,SW),
])
def po_backslash(p): draw_glyph(p,[D(0,H,W,0,SW)])
def po_bracketright(p): draw_glyph(p,[
    R(W*3//4-SW,0,W*3//4,H), R(W//4,TS,W*3//4,H), R(W//4,0,W*3//4,SW),
])
def po_asciicircum(p): draw_glyph(p,[D(0,H//2,W//2,H,SW), D(W//2,H,W,H//2,SW)])
def po_underscore(p): draw_glyph(p,[R(0,-HS,W,HS)])
def po_grave(p): draw_glyph(p,[D(W//4,H,W*3//4,TS,SW)])
def po_braceleft(p): draw_glyph(p,[
    R(W//3,0,W//3+SW,H), R(W//3,TS,W*3//4,H), R(W//3,0,W*3//4,SW),
    R(W//3,MH,W,MC), R(W//6,MH,W//3+SW,MC),
])
def po_bar(p): draw_glyph(p,[R(W//2-HS,0,W//2+HS,H)])
def po_braceright(p): draw_glyph(p,[
    R(W*2//3-SW,0,W*2//3,H), R(W//4,TS,W*2//3,H), R(W//4,0,W*2//3,SW),
    R(0,MH,W*2//3,MC), R(W*2//3-SW,MH,W*5//6,MC),
])
def po_asciitilde(p): draw_glyph(p,[
    D(0,H//2-SW,W//3,H//2+SW,SW), D(W//3,H//2+SW,W*2//3,H//2-SW,SW),
    D(W*2//3,H//2-SW,W,H//2+SW,SW),
])

def po_notdef(p): draw_glyph(p,[
    R(SW,0,W-SW,SW), R(SW,H-SW,W-SW,H), R(SW,0,SW*2,H), R(W-SW*2,0,W-SW,H),
])

def make_pentaorbit():
    gd = {'.notdef': (ADV, po_notdef)}
    for ch, fn in UPPER_FNS.items():
        adv = ADV_W if ch in ('M','W') else ADV
        gd[ord(ch)] = (adv, fn)
    for ch, fn in LOWER_FNS.items():
        adv = ADV_W if ch in ('m','w') else ADV_N if ch in ('i','j','l','f','r','t') else ADV_L
        gd[ord(ch)] = (adv, fn)
    for ch, fn in DIGIT_FNS.items():
        gd[ord(ch)] = (ADV, fn)
    PUNCT = {
        0x20:(ADV//3,po_space), 0x21:(ADV_N,po_exclam), 0x22:(ADV_L,po_quotedbl),
        0x23:(ADV,po_numbersign), 0x24:(ADV,po_dollar), 0x25:(ADV,po_percent),
        0x26:(ADV,po_ampersand), 0x27:(ADV_N,po_quotesingle),
        0x28:(ADV_N+SW*2,po_parenleft), 0x29:(ADV_N+SW*2,po_parenright),
        0x2A:(ADV,po_asterisk), 0x2B:(ADV,po_plus), 0x2C:(ADV_N,po_comma),
        0x2D:(ADV_L,po_hyphen), 0x2E:(ADV_N,po_period), 0x2F:(ADV,po_slash),
        0x3A:(ADV_N,po_colon), 0x3B:(ADV_N,po_semicolon), 0x3C:(ADV,po_less),
        0x3D:(ADV,po_equal), 0x3E:(ADV,po_greater), 0x3F:(ADV,po_question),
        0x40:(ADV,po_at), 0x5B:(ADV_N+SW*2,po_bracketleft),
        0x5C:(ADV,po_backslash), 0x5D:(ADV_N+SW*2,po_bracketright),
        0x5E:(ADV,po_asciicircum), 0x5F:(ADV,po_underscore),
        0x60:(ADV_N,po_grave), 0x7B:(ADV_N+SW*3,po_braceleft),
        0x7C:(ADV_N,po_bar), 0x7D:(ADV_N+SW*3,po_braceright),
        0x7E:(ADV,po_asciitilde),
    }
    gd.update(PUNCT)
    build('PentaOrbit','Regular',800,780,-200,700,490,gd,'PentaOrbit-Regular.ttf')


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Generating PentaProtocol custom fonts…')
    make_pentapixel()
    make_pentaorbit()
    print('Done.')
