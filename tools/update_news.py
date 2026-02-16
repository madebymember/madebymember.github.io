#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Atnaujina index.html <div class="news-grid"> turinį 3 naujausiomis kortelėmis.

Logika:
- Nuskaito kelis nurodytus URL (HTML ar RSS – čia pavyzdyje HTML).
- Ištraukia: pavadinimą (og:title/title), publikavimo datą (meta/time).
- Filtruoja pagal KEYWORDS (siekiant relevancijos „Šalin rankas“/LRT).
- Paimami 3 naujausi įrašai; 1-oji kortelė pažymima .critical.
- Perrašo tik .news-grid HTML, likusio failo neliest.

Reikalavimai: requests, beautifulsoup4, lxml, python-dateutil
"""

import os
import re
import sys
import hashlib
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dtparse

INDEX_PATH = "index.html"

# Papildyk pagal poreikį
KEYWORDS = [
    "Šalin rankas",
    "LRT",
    "įstatym",
    "valdyb",
    "Seimas",
    "pavasario sesij",
]

# Pagrindiniai stebimi šaltiniai (galima pridėti daugiau, tame tarpe ir RSS)
SOURCES = [
    # LRT / Delfi / Laikas.lt – LRT įstatymo pokyčiai, ministrės komentarai
    "https://www.lrt.lt/naujienos/lietuvoje/2/2833085/aleknaviciene-lrt-istatyme-mato-valdybos-atsiradimo-galimybe",
    "https://www.delfi.lt/naujienos/lietuvoje/aleknaviciene-apie-lrt-istatyma-mato-valdybos-atsiradimo-galimybe-120209152",
    "https://www.laikas.lt/kas-keistusi-lrt-veikloje-aleknaviciene-pasisako-apie-butinas-istatymo-korekcijas-134761/",
    # TV3 / KaunoDiena – „Šalin rankas“ akcijos finansavimo kontekstas
    "https://www.tv3.lt/naujiena/verslas/lrt-atskleide-kas-finansavo-salin-rankas-protesto-akcija-n1485401",
    "https://kauno.diena.lt/naujienos/lietuva/salies-pulsas/lrt-protesto-akcija-salin-rankas-suorganizuota-iniciatyvoje-dalyvaujanciu-darbuotoju-resursais-1737382/",
    # e‑Seimas / Infolex – pavasario sesijos darbotvarkės kontekstas
    "https://e-seimas.lrs.lt/portal/legalAct/lt/TAD/bd021e12095811f0a1c6f244a8c21f99",
    "https://www.infolex.lt/ta/1009042",
]

UA = {
    "User-Agent": "GitHubActions-NewsBot/1.0 (+github.com; Šalin-rankas auto-update)",
    "Accept-Language": "lt,lt-LT;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Connection": "keep-alive",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
}

def fetch_html(url: str) -> BeautifulSoup:
    r = requests.get(url, headers=UA, timeout=25)
    r.raise_for_status()
    return BeautifulSoup(r.text, "lxml")

def first_nonempty_text(soup: BeautifulSoup, selectors: list[str]) -> str | None:
    for sel in selectors:
        el = soup.select_one(sel)
        if not el:
            continue
        # prioritetas content, tada tekstas
        txt = el.get("content") or el.get_text(" ", strip=True)
        if txt:
            return re.sub(r"\s+", " ", txt).strip()
    return None

def parse_date(soup: BeautifulSoup):
    # bandome dažniausius meta/time laukus
    cands = [
        "meta[property='article:published_time']",
        "meta[name='date']",
        "meta[property='og:updated_time']",
        "meta[itemprop='datePublished']",
        "time[datetime]",
        "meta[name='pubdate']",
    ]
    s = first_nonempty_text(soup, cands)
    if s:
        try:
            return dtparse.parse(s)
        except Exception:
            pass
    # fallback: <time> tekstas
    t = soup.find("time")
    if t:
        txt = t.get_text(" ", strip=True)
        if txt:
            try:
                return dtparse.parse(txt, dayfirst=True, fuzzy=True)
            except Exception:
                pass
    return None  # nežinoma

def matches_keywords(text: str) -> bool:
    t = text.lower()
    return any(kw.lower() in t for kw in KEYWORDS)

def extract_item(url: str) -> dict:
    soup = fetch_html(url)
    title = first_nonempty_text(soup, [
        "meta[property='og:title']",
        "meta[name='title']",
        "title",
        "h1",
    ]) or url
    date = parse_date(soup)
    src  = urlparse(url).netloc.replace("www.", "")
    return {
        "title": title,
        "date": date.isoformat() if date else None,
        "link": url,
        "source": src,
    }

def collect_items() -> list[dict]:
    items = []
    for u in SOURCES:
        try:
            it = extract_item(u)
            if matches_keywords(it["title"]):
                items.append(it)
        except Exception as e:
            # jei šaltinis pasiekiamas su klaida – praleidžiam
            continue

    # rikiuojam: pirmiausia turintys datą, pagal datą – naujausi viršuje
    def sort_key(it):
        return (it["date"] is not None, it["date"] or "")
    items.sort(key=sort_key, reverse=True)

    # traukiam TOP-3
    return items[:3]

def escape_html(s: str) -> str:
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
             .replace('"', "&quot;"))

def render_card(it: dict, idx: int) -> str:
    # data rodyti kaip YYYY-MM-DD, jei žinoma; kitaip – „Kontekstas“
    date_tag = "Kontekstas"
    if it["date"]:
        try:
            from datetime import date as _d
            d = dtparse.parse(it["date"]).date().isoformat()
            date_tag = d
        except Exception:
            pass

    is_crit = " critical" if idx == 0 else ""
    is_crit_tag = " is-critical" if idx == 0 else ""

    title = escape_html(it["title"])
    link  = escape_html(it["link"])
    src   = escape_html(it["source"])

    # trumpa, saugi kortelė su aktyvia nuoroda
    return f"""
<article class="news-card{is_crit}">
  <span class="date-tag{is_crit_tag}">{date_tag}</span>
  <h3>{title[:140]}</h3>
  <p>
    Išsamiau:
    {link}{src}</a>
  </p>
</article>
""".strip()

def update_index(cards_html: str) -> bool:
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        old_html = f.read()

    soup = BeautifulSoup(old_html, "lxml")
    grid = soup.select_one("div.news-grid")
    if not grid:
        print("[WARN] .news-grid nerasta – failas nebuvo keičiamas", file=sys.stderr)
        return False

    # Išvalyti esamus <article> ir įdėti naujus
    grid.clear()
    fragment = BeautifulSoup(cards_html, "lxml")
    for art in fragment.select("article"):
        grid.append(art)

    new_html = str(soup)
    if hashlib.sha256(new_html.encode("utf-8")).hexdigest() != hashlib.sha256(old_html.encode("utf-8")).hexdigest():
        with open(INDEX_PATH, "w", encoding="utf-8") as f:
            f.write(new_html)
        return True
    return False

def main():
    items = collect_items()
    if not items:
        print("[INFO] Naujų įrašų nerasta – index.html nekeičiamas")
        return

    cards = [render_card(it, i) for i, it in enumerate(items)]
    changed = update_index("\n".join(cards))
    if changed:
        print("[OK] index.html naujienų kortelės atnaujintos")
    else:
        print("[INFO] Pakeitimų nenustatyta")

if __name__ == "__main__":
    main()