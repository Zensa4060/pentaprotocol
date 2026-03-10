# constants.py
# All layout constants, colours, and fonts.
# pygame.init() must be called before this module is imported.

import pygame

# ================= SCREEN =================

info          = pygame.display.Info()
SCREEN_WIDTH  = info.current_w
SCREEN_HEIGHT = info.current_h

screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("5x5 Arena")

# ================= LAYOUT =================

BOARD_SIZE = int(SCREEN_HEIGHT * 0.75)
CELL_SIZE  = BOARD_SIZE // 5

BOARD_X = (SCREEN_WIDTH  // 2) - (BOARD_SIZE // 2)
BOARD_Y = (SCREEN_HEIGHT // 2) - (BOARD_SIZE // 2)

MATCH_PANEL_WIDTH = 360
LOG_PANEL_WIDTH   = 500

MATCH_PANEL_X = BOARD_X - MATCH_PANEL_WIDTH - 60
LOG_PANEL_X   = BOARD_X + BOARD_SIZE + 60

# ================= LOG FONT SIZING =================

LOG_HEADER_H  = 70
LOG_ENTRY_H   = (BOARD_SIZE - LOG_HEADER_H) // 25
LOG_FONT_SIZE = max(14, int(LOG_ENTRY_H * 0.80))

# ================= COLOURS =================

BG_COLOR    = (15, 15, 20)
BOARD_COLOR = (30, 30, 38)
PANEL_COLOR = (35, 35, 45)
LINE_COLOR  = (200, 200, 200)

P1_COLOR  = (0, 191, 255)
P2_COLOR  = (255, 105, 180)

GREEN_WIN  = (0, 255, 0)
GOLD_WIN   = (255, 215, 0)
GOLD_HOVER = (255, 215, 0)

READY_GREEN = (0, 170, 0)
READY_RED   = (170, 0, 0)

LOG_COLORS = [
    (255, 80,  80),  (255, 160,  40), (255, 220,  50), (180, 255,  60),
    (60,  255, 120), (40,  230, 230), (60,  160, 255), (130,  80, 255),
    (230,  60, 230), (255,  80, 160), (255, 140, 100), (100, 255, 200),
    (200, 100, 255), (255, 200, 100), (80,  200, 255), (255,  80, 200),
    (160, 255,  80), (255, 120, 180), (120, 220, 180), (220, 180, 255),
    (255, 180, 120), (80,  255, 160), (200, 255, 120), (255, 100, 100),
    (100, 200, 255),
]

# ================= FONTS =================

FONT           = pygame.font.Font(None, 80)
SMALL_FONT     = pygame.font.Font(None, 26)
TITLE_FONT     = pygame.font.Font(None, 36)
LABEL_FONT     = pygame.font.Font(None, 28)
TIMER_FONT     = pygame.font.Font(None, 52)
LOG_TITLE_FONT = pygame.font.Font(None, 46)
LOG_FONT       = pygame.font.Font(None, LOG_FONT_SIZE)