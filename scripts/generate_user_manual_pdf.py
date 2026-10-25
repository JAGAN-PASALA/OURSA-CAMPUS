#!/usr/bin/env python3
"""Generate the printable OUR'S user manual from docs/USER_MANUAL.md."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "USER_MANUAL.md"
OUTPUT = ROOT / "output" / "pdf" / "OURS_Smart_Classroom_v7_User_Manual.pdf"

NAVY = colors.HexColor("#242A45")
INDIGO = colors.HexColor("#4F46C8")
PALE = colors.HexColor("#F2F3FA")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#5B6475")
LINE = colors.HexColor("#D8DCE8")

pdfmetrics.registerFont(TTFont("OursSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("OursSans-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("OursMono", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"))


def ascii_text(value: str) -> str:
    return (
        value.replace("\u2011", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2192", "->")
    )


def inline_markup(value: str) -> str:
    value = html.escape(ascii_text(value.strip()))
    value = re.sub(r"`([^`]+)`", r'<font name="OursMono">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    return value


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ManualTitle",
            parent=base["Title"],
            fontName="OursSans-Bold",
            fontSize=30,
            leading=35,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "ManualSubtitle",
            parent=base["Normal"],
            fontName="OursSans",
            fontSize=12,
            leading=18,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "ManualH1",
            parent=base["Heading1"],
            fontName="OursSans-Bold",
            fontSize=18,
            leading=23,
            textColor=NAVY,
            spaceBefore=5,
            spaceAfter=10,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "ManualH2",
            parent=base["Heading2"],
            fontName="OursSans-Bold",
            fontSize=13.5,
            leading=18,
            textColor=INDIGO,
            spaceBefore=10,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "ManualH3",
            parent=base["Heading3"],
            fontName="OursSans-Bold",
            fontSize=11.5,
            leading=15,
            textColor=NAVY,
            spaceBefore=8,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "ManualBody",
            parent=base["BodyText"],
            fontName="OursSans",
            fontSize=9.4,
            leading=13.5,
            textColor=INK,
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "ManualBullet",
            parent=base["BodyText"],
            fontName="OursSans",
            fontSize=9.2,
            leading=13,
            textColor=INK,
        ),
        "code": ParagraphStyle(
            "ManualCode",
            parent=base["Code"],
            fontName="OursMono",
            fontSize=8,
            leading=11,
            textColor=NAVY,
            backColor=PALE,
            borderColor=LINE,
            borderWidth=0.5,
            borderPadding=7,
            spaceBefore=4,
            spaceAfter=7,
        ),
        "table_header": ParagraphStyle(
            "ManualTableHeader",
            parent=base["BodyText"],
            fontName="OursSans-Bold",
            fontSize=8.2,
            leading=10.5,
            textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "ManualTableCell",
            parent=base["BodyText"],
            fontName="OursSans",
            fontSize=7.8,
            leading=10.4,
            textColor=INK,
        ),
        "cover_note": ParagraphStyle(
            "CoverNote",
            parent=base["BodyText"],
            fontName="OursSans",
            fontSize=10,
            leading=15,
            textColor=INK,
            leftIndent=12,
            rightIndent=12,
        ),
    }


def table_flowable(rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> Table:
    count = max(len(row) for row in rows)
    normalized = [row + [""] * (count - len(row)) for row in rows]
    lengths = [max(len(row[index]) for row in normalized) for index in range(count)]
    weights = [max(10, min(length, 42)) for length in lengths]
    available = A4[0] - 32 * mm
    widths = [available * weight / sum(weights) for weight in weights]
    cells = []
    for row_index, row in enumerate(normalized):
        style = styles["table_header"] if row_index == 0 else styles["table_cell"]
        cells.append([Paragraph(inline_markup(cell), style) for cell in row])
    table = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
            ]
        )
    )
    return table


def parse_manual(markdown: str, styles: dict[str, ParagraphStyle]) -> list:
    lines = markdown.splitlines()[1:]
    story: list = []
    paragraph: list[str] = []
    bullet_items: list[str] = []
    numbered_items: list[str] = []
    code_lines: list[str] = []
    in_code = False

    def flush_paragraph() -> None:
        if paragraph:
            story.append(Paragraph(inline_markup(" ".join(paragraph)), styles["body"]))
            paragraph.clear()

    def flush_lists() -> None:
        if bullet_items:
            story.append(
                ListFlowable(
                    [ListItem(Paragraph(inline_markup(item), styles["bullet"])) for item in bullet_items],
                    bulletType="bullet",
                    bulletFontName="OursSans",
                    bulletFontSize=7,
                    leftIndent=16,
                    bulletOffsetY=1,
                    spaceAfter=6,
                )
            )
            bullet_items.clear()
        if numbered_items:
            story.append(
                ListFlowable(
                    [ListItem(Paragraph(inline_markup(item), styles["bullet"])) for item in numbered_items],
                    bulletType="1",
                    start="1",
                    leftIndent=19,
                    spaceAfter=6,
                )
            )
            numbered_items.clear()

    index = 0
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if stripped.startswith("```"):
            flush_paragraph()
            flush_lists()
            if in_code:
                story.append(Paragraph("<br/>".join(html.escape(ascii_text(line)) for line in code_lines), styles["code"]))
                code_lines.clear()
            in_code = not in_code
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-+", lines[index + 1]):
            flush_paragraph()
            flush_lists()
            table_rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", cell.replace(" ", "")) for cell in row):
                    table_rows.append(row)
                index += 1
            story.extend([table_flowable(table_rows, styles), Spacer(1, 7)])
            continue
        heading = re.match(r"^(#{2,4})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            flush_lists()
            level = len(heading.group(1))
            if level == 2 and story:
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(heading.group(2)), styles[{2: "h1", 3: "h2", 4: "h3"}[level]]))
            index += 1
            continue
        if stripped.startswith("- "):
            flush_paragraph()
            if numbered_items:
                flush_lists()
            bullet_items.append(stripped[2:])
            index += 1
            continue
        numbered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if numbered:
            flush_paragraph()
            if bullet_items:
                flush_lists()
            numbered_items.append(numbered.group(1))
            index += 1
            continue
        if not stripped:
            flush_paragraph()
            flush_lists()
        else:
            paragraph.append(stripped)
        index += 1
    flush_paragraph()
    flush_lists()
    return story


def decorate_page(canvas, document) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(16 * mm, 14 * mm, width - 16 * mm, 14 * mm)
    canvas.setFont("OursSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 9.5 * mm, "OUR'S Smart Classroom v7.0 - User Manual")
    canvas.drawRightString(width - 16 * mm, 9.5 * mm, f"Page {document.page}")
    canvas.restoreState()


def main() -> None:
    styles = build_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=17 * mm,
        bottomMargin=19 * mm,
        title="OUR'S Smart Classroom v7.0 - User Manual",
        author="OUR'S Smart Classroom",
        subject="Role-based deployment and usage guide",
    )
    story = [
        Spacer(1, 34 * mm),
        Paragraph("OUR'S", styles["title"]),
        Paragraph("Smart Classroom v7.0", styles["title"]),
        Spacer(1, 5 * mm),
        Paragraph("Role-based user, operations and secure deployment manual", styles["subtitle"]),
        Spacer(1, 20 * mm),
        KeepTogether(
            [
                Table(
                    [[Paragraph("PLATFORM", styles["table_header"]), Paragraph("COLLEGE", styles["table_header"]), Paragraph("CLASSROOM", styles["table_header"])],
                     [Paragraph("Domains, support consent, system status and model releases", styles["table_cell"]), Paragraph("Accounts, departments, fees, timetable and academic controls", styles["table_cell"]), Paragraph("Attendance, assignments, tests, face enrolment and reviewed analytics", styles["table_cell"])]],
                    colWidths=[(A4[0] - 40 * mm) / 3] * 3,
                    style=TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]),
                ),
                Spacer(1, 12 * mm),
                Paragraph("Keep the completed .env, passwords, reset links, biometric key, database exports and camera/provider credentials private. Production use requires HTTPS, legal/privacy review, representative accuracy testing, backups and human review.", styles["cover_note"]),
            ]
        ),
        Spacer(1, 22 * mm),
        Paragraph("Release date: 22 September 2026", styles["subtitle"]),
        PageBreak(),
    ]
    story.extend(parse_manual(SOURCE.read_text(encoding="utf-8"), styles))
    document.build(story, onFirstPage=decorate_page, onLaterPages=decorate_page)
    print(OUTPUT)


if __name__ == "__main__":
    main()
