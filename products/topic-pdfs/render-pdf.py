#!/usr/bin/env python3
"""Render a Topic PDF Markdown manuscript into a branded editorial-proof PDF.

This is a lightweight, dependency-explicit first renderer, not a complete
CommonMark implementation. It supports headings, paragraphs, emphasis,
links, unordered/ordered lists, horizontal rules and simple pipe tables.
"""
from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

DRAFT_MARK = "EDITORIAL DRAFT — NOT FOR SALE"


def inline_markup(value: str) -> str:
    value = html.escape(value, quote=False)
    value = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r'<link href="\2" color="#174a7e">\1</link>', value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    value = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", value)
    return value


def parse_table(lines: list[str], styles: dict) -> Table:
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells):
            continue
        rows.append([Paragraph(inline_markup(cell), styles["table_cell"]) for cell in cells])
    width = A4[0] - 36 * mm
    count = max((len(row) for row in rows), default=1)
    table = Table(rows, colWidths=[width / count] * count, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e9eef4")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1c2b39")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c8d0d8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("CoverTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=26, leading=31, alignment=TA_CENTER, textColor=colors.HexColor("#142a3a"), spaceAfter=14),
        "subtitle": ParagraphStyle("CoverSubtitle", parent=base["Normal"], fontSize=14, leading=20, alignment=TA_CENTER, textColor=colors.HexColor("#526475"), spaceAfter=18),
        "h1": ParagraphStyle("TopicH1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=colors.HexColor("#17354c"), spaceBefore=16, spaceAfter=9, keepWithNext=True),
        "h2": ParagraphStyle("TopicH2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13.5, leading=18, textColor=colors.HexColor("#234d68"), spaceBefore=12, spaceAfter=6, keepWithNext=True),
        "h3": ParagraphStyle("TopicH3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, spaceBefore=9, spaceAfter=4, keepWithNext=True),
        "body": ParagraphStyle("TopicBody", parent=base["BodyText"], fontName="Helvetica", fontSize=10.2, leading=15.2, alignment=TA_LEFT, textColor=colors.HexColor("#202a33"), spaceAfter=8),
        "bullet": ParagraphStyle("TopicBullet", parent=base["BodyText"], fontName="Helvetica", fontSize=10.1, leading=14.6, leftIndent=15, firstLineIndent=-9, spaceAfter=4),
        "table_cell": ParagraphStyle("TopicTableCell", parent=base["BodyText"], fontSize=8.5, leading=11, spaceAfter=0),
        "small": ParagraphStyle("TopicSmall", parent=base["Normal"], fontSize=9, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#5a6570")),
    }


def page_decor(canvas, doc):
    canvas.saveState()
    page_w, page_h = A4
    canvas.setFillColor(colors.HexColor("#a33b2f"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(page_w / 2, page_h - 10 * mm, DRAFT_MARK)
    canvas.setStrokeColor(colors.HexColor("#d5dce2"))
    canvas.line(18 * mm, 14 * mm, page_w - 18 * mm, 14 * mm)
    canvas.setFillColor(colors.HexColor("#65727e"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9 * mm, "Bevan Shelton • Topic PDF Publishing Programme")
    canvas.drawRightString(page_w - 18 * mm, 9 * mm, f"Proof • {doc.page}")
    canvas.restoreState()


def render_markdown(source: Path, output: Path):
    text = source.read_text(encoding="utf-8")
    lines = text.splitlines()
    styles = build_styles()
    story = []
    title = source.stem.replace("-", " ").title()
    subtitle = ""
    author = "Bevan Shelton"
    edition = "Editorial draft"

    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
        elif line.startswith("## ") and not subtitle:
            subtitle = line[3:].strip()
        elif line.startswith("**Author:**"):
            author = line.split(":", 1)[1].replace("**", "").strip()
        elif line.startswith("**Edition:**"):
            edition = line.split(":", 1)[1].replace("**", "").strip()

    story.extend([
        Spacer(1, 48 * mm),
        Paragraph(inline_markup(title), styles["title"]),
        Paragraph(inline_markup(subtitle), styles["subtitle"]),
        Spacer(1, 12 * mm),
        Paragraph(f"<b>Written by {html.escape(author)}</b>", styles["small"]),
        Spacer(1, 4 * mm),
        Paragraph(html.escape(edition), styles["small"]),
        Spacer(1, 4 * mm),
        Paragraph("DRAFT PROOF • NOT FOR SALE", styles["small"]),
        PageBreak(),
    ])

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line == "---" or line.startswith("# ") or line.startswith("**Author:**") or line.startswith("**Edition:**") or line.startswith("**Product series:**") or line.startswith("**Status:**") or line.startswith("**Price target:**") or line.startswith("**Editorial note:**"):
            if line == "---":
                story.append(Spacer(1, 3 * mm))
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#c9d1d8")))
            i += 1
            continue
        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            story.append(parse_table(table_lines, styles))
            story.append(Spacer(1, 4 * mm))
            continue
        if line.startswith("### "):
            story.append(Paragraph(inline_markup(line[4:]), styles["h3"]))
            i += 1
            continue
        if line.startswith("## "):
            story.append(Paragraph(inline_markup(line[3:]), styles["h2"]))
            i += 1
            continue
        if line.startswith("# "):
            story.append(Paragraph(inline_markup(line[2:]), styles["h1"]))
            i += 1
            continue
        if line.startswith("- ") or line.startswith("* "):
            story.append(Paragraph("• " + inline_markup(line[2:]), styles["bullet"]))
            i += 1
            continue
        numbered = re.match(r"^(\d+)\.\s+(.*)$", line)
        if numbered:
            story.append(Paragraph(f"{numbered.group(1)}. " + inline_markup(numbered.group(2)), styles["bullet"]))
            i += 1
            continue
        story.append(Paragraph(inline_markup(line), styles["body"]))
        i += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output), pagesize=A4,
        rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=20 * mm,
        title=title, author=author,
        subject="Editorial proof for the $7 Topic PDF Publishing Programme",
    )
    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Markdown manuscript")
    parser.add_argument("output", type=Path, help="Output PDF path")
    args = parser.parse_args()
    render_markdown(args.source, args.output)
    if not args.output.exists() or args.output.stat().st_size < 1000:
        raise SystemExit("PDF generation failed or output is unexpectedly small")
    print(f"Rendered editorial proof: {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
