"""Cross-border launch (customer-facing) creatives, 30 Sep 2026.
SG -> JB & KL, quote-based, verified cross-border drivers, customs paperwork handled.
Outputs: LinkedIn square 1200x1200 (URL), LinkedIn/FB landscape 1200x627 (URL),
Carousell/Telegram square 1080x1080 (no URL, no phone).
Same layout family as banners v5/v6 (Sae still + navy panel). No 'AI-generated' text on image (Scott, 26 Sep).
"""
import os
from PIL import Image, ImageDraw
from banners_v5 import (font, fit_font, photo_panel, gradient_panel, wordmark, chip, para,
                        NAVY, CYAN, ORANGE, ORANGE2, WHITE, GREY, BLACK_F, BOLD_F, REG_F, STILLS)

OUT = '/mnt/user-data/outputs/crossborder-launch/'
os.makedirs(OUT, exist_ok=True)

BODY = ('Hand us the delivery and it is handled: verified cross-border drivers, '
        'customs paperwork, live tracking to the door. One quote, one point of contact. '
        'Nothing charged until you accept.')
LINE_A = 'Van to 3-tonne lorry · Door to door'
LINE_B = 'Tech & IT equipment · Pilot runs from October'
TAIL_URL = 'app.techchainglobal.com · iPhone app on the App Store · Android by invite'
TAIL_NOURL = "Sign up on the TCG Express web app or search 'TCG Express' on the App Store and request a quote."


def build_square(photo, out, W=1080, H=1080, url=False, focus=0.45):
    PW = int(W * 0.5)
    canvas = Image.new('RGB', (W, H), NAVY)
    canvas.paste(photo_panel(photo, PW, H, focus), (0, 0))
    canvas.paste(gradient_panel(W - PW, H), (PW, 0))
    d = ImageDraw.Draw(canvas)
    d.rectangle([PW, 0, PW + 8, H], fill=ORANGE)
    x0 = PW + 44; maxw = W - x0 - 40
    s = W / 1080
    wordmark(d, x0, int(52 * s), int(44 * s))
    y = int(150 * s)
    f = fit_font(BLACK_F, 'SINGAPORE →', maxw, int(86 * s)); d.text((x0, y), 'SINGAPORE →', font=f, fill=WHITE); y += f.size + 2
    f2 = fit_font(BLACK_F, 'JB & KL', maxw, int(118 * s)); d.text((x0, y), 'JB & KL', font=f2, fill=ORANGE2); y += f2.size + int(18 * s)
    f3 = fit_font(BOLD_F, 'Cross-border B2B delivery · now open', maxw, int(34 * s)); d.text((x0, y), 'Cross-border B2B delivery · now open', font=f3, fill=CYAN); y += int(66 * s)
    y = para(d, x0, y, BODY, font(REG_F, int(29 * s)), maxw, GREY, int(41 * s))
    y += int(18 * s)
    f5 = fit_font(BLACK_F, LINE_A, maxw, int(36 * s)); d.text((x0, y), LINE_A, font=f5, fill=WHITE); y += f5.size + int(8 * s)
    f6 = fit_font(BOLD_F, LINE_B, maxw, int(28 * s)); d.text((x0, y), LINE_B, font=f6, fill=ORANGE2); y += f6.size + int(30 * s)
    cw, chh = chip(d, x0, y, 'REQUEST A QUOTE', font(BLACK_F, int(36 * s)), ORANGE); y += chh + int(30 * s)
    para(d, x0, y, TAIL_URL if url else TAIL_NOURL, font(REG_F, int(24 * s)), maxw, GREY, int(34 * s))
    canvas.save(out, quality=93)
    print('saved', out, canvas.size)


def build_landscape(photo, out, W=1200, H=627, focus=0.45):
    PW = int(W * 0.42)
    canvas = Image.new('RGB', (W, H), NAVY)
    canvas.paste(photo_panel(photo, PW, H, focus), (0, 0))
    canvas.paste(gradient_panel(W - PW, H), (PW, 0))
    d = ImageDraw.Draw(canvas)
    d.rectangle([PW, 0, PW + 8, H], fill=ORANGE)
    x0 = PW + 40; maxw = W - x0 - 36
    wordmark(d, x0, 34, 36)
    y = 96
    f = fit_font(BLACK_F, 'SINGAPORE → JB & KL', maxw, 78); d.text((x0, y), 'SINGAPORE → JB & KL', font=f, fill=WHITE); y += f.size + 6
    f3 = fit_font(BOLD_F, 'Cross-border B2B delivery · now open', maxw, 26); d.text((x0, y), 'Cross-border B2B delivery · now open', font=f3, fill=CYAN); y += 48
    y = para(d, x0, y, BODY, font(REG_F, 24), maxw, GREY, 33)
    y += 14
    f5 = fit_font(BLACK_F, LINE_A, maxw, 30); d.text((x0, y), LINE_A, font=f5, fill=WHITE); y += f5.size + 22
    cw, chh = chip(d, x0, y, 'REQUEST A QUOTE', font(BLACK_F, 30), ORANGE, pad=16)
    para(d, x0 + cw + 22, y + 10, 'app.techchainglobal.com', font(BOLD_F, 24), maxw - cw - 22, WHITE, 30)
    canvas.save(out, quality=93)
    print('saved', out, canvas.size)


if __name__ == '__main__':
    build_square(STILLS + '07_lorry_a.jpg', OUT + 'TCG-crossborder-launch-linkedin-1200.jpg', W=1200, H=1200, url=True)
    build_square(STILLS + '07_lorry_a.jpg', OUT + 'TCG-crossborder-launch-carousell-1080.jpg', W=1080, H=1080, url=False)
    build_landscape(STILLS + '04_van_rear_a.jpg', OUT + 'TCG-crossborder-launch-1200x627.jpg')
