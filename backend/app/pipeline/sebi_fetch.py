"""
Real SEBI circular ingestion — the production implementation of the seam
`monitor_node` (pipeline/monitor.py) has always documented: "In production
this would poll SEBI's circular index... For the demo, a 'new circular' is
supplied directly as `notice_text`."

This module is that production path. Verified against SEBI's real, live
infrastructure (not assumed):

- SEBI's combined RSS feed (press releases + orders + circulars, at
  https://www.sebi.gov.in/sebirss.xml) turned out to be unreliable as the
  primary source in practice: circulars are infrequent enough that they
  routinely scroll out of the feed's most-recent-20-items window entirely
  (verified live — the feed returned zero /legal/circulars/ items on a real
  poll). The circulars-specific listing page
  (sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0) does not
  have that problem — it is the canonical, always-current circulars index,
  so that's the primary source here. There is still no JSON/structured API;
  this is HTML table scraping, chosen deliberately over adding a heavy HTML
  parser dependency since the table row shape
  (`<td>date</td><td><a href="..." title="...">...`) is simple and stable.
- Each circular's detail page embeds the actual PDF in an <iframe src="...">
  pointing at sebi_data/attachdocs/<month>-<year>/<id>.pdf.
- PDF text extraction uses pdfplumber. Tested against a real, current SEBI
  circular (SIF distributor certification, July 2026) — clean digital text,
  no OCR needed for that document. Scanned/image-only circulars would defeat
  this and are a known limitation, not silently handled.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

SEBI_CIRCULARS_LISTING_URL = "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0"

_LISTING_ROW_RE = re.compile(
    r"<td>([^<]+)</td>\s*<td><a href=\"([^\"]+)\"[^>]*title=\"([^\"]*)\"",
    re.IGNORECASE,
)
_PDF_IFRAME_RE = re.compile(r"<iframe[^>]+src=['\"][^'\"]*file=(https?://[^'\"&]+\.pdf)", re.IGNORECASE)
_CIRCULAR_NO_RE = re.compile(r"Circular No\.:\s*</span>\s*<span>([^<]+)</span>", re.IGNORECASE)
_DATE_RE = re.compile(r"<div class='date_value'><h5>([^<]+)</h5>")


@dataclass
class FeedItem:
    title: str
    link: str
    pub_date: str


@dataclass
class CircularDetail:
    title: str
    link: str
    circular_no: str | None
    date: str | None
    pdf_url: str | None
    text: str


class SebiFetchError(RuntimeError):
    """Raised when SEBI's site is unreachable or its page structure has
    changed in a way this module doesn't know how to parse — surfaced to
    the caller with a clear message rather than silently returning nothing,
    since a silent empty result would be indistinguishable from "no new
    circulars" and mask a real breakage of a third-party site we don't
    control."""


def fetch_circular_feed_items(limit: int = 20) -> list[FeedItem]:
    """Scrapes SEBI's real, always-current circulars listing page — see the
    module docstring for why this is used instead of the RSS feed."""
    try:
        resp = httpx.get(SEBI_CIRCULARS_LISTING_URL, timeout=20.0, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise SebiFetchError(f"Could not reach SEBI's circulars listing page: {exc}") from exc

    rows = _LISTING_ROW_RE.findall(resp.text)
    if not rows:
        raise SebiFetchError(
            "Found no circular rows on SEBI's listing page — its HTML structure may "
            "have changed since this scraper was written."
        )

    items: list[FeedItem] = []
    for pub_date, link, title in rows[:limit]:
        items.append(FeedItem(title=title.strip(), link=link.strip(), pub_date=pub_date.strip()))
    return items


def fetch_circular_detail(link: str) -> CircularDetail:
    """Fetches a circular's detail page, pulls out the circular number/date
    (present as plain HTML on the page) and the embedded PDF URL, downloads
    that PDF, and extracts its text with pdfplumber."""
    try:
        page = httpx.get(link, timeout=20.0, follow_redirects=True)
        page.raise_for_status()
    except httpx.HTTPError as exc:
        raise SebiFetchError(f"Could not fetch circular detail page: {exc}") from exc

    html = page.text
    title_match = re.search(r"<h1>([^<]+)", html)
    title = title_match.group(1).strip() if title_match else link

    circular_no_match = _CIRCULAR_NO_RE.search(html)
    circular_no = circular_no_match.group(1).strip() if circular_no_match else None

    date_match = _DATE_RE.search(html)
    date = date_match.group(1).strip() if date_match else None

    pdf_match = _PDF_IFRAME_RE.search(html)
    if not pdf_match:
        raise SebiFetchError(
            "Could not find an embedded PDF link on the circular detail page — "
            "SEBI's page layout may have changed since this parser was written."
        )
    pdf_url = pdf_match.group(1)

    text = _extract_pdf_text(pdf_url)

    return CircularDetail(title=title, link=link, circular_no=circular_no, date=date, pdf_url=pdf_url, text=text)


def _extract_pdf_text(pdf_url: str) -> str:
    try:
        import pdfplumber  # local import: only needed on this real-fetch code path
    except ImportError as exc:
        raise SebiFetchError("pdfplumber is not installed — add it to backend/requirements.txt.") from exc

    try:
        resp = httpx.get(pdf_url, timeout=30.0, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise SebiFetchError(f"Could not download the circular PDF: {exc}") from exc

    import io

    pages_text: list[str] = []
    with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
        for page in pdf.pages:
            pages_text.append(page.extract_text() or "")

    text = "\n".join(pages_text).strip()
    if not text:
        raise SebiFetchError(
            "The circular PDF produced no extractable text — it is likely a scanned "
            "image rather than digital text, which this module does not OCR."
        )
    return text
