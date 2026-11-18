import io
from datetime import datetime, timezone
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
    Image as RLImage,
)
from reportlab.pdfgen import canvas
from config.mongodb import get_db

# MithaiMart Brand Palette
COLOR_MAHOGANY = colors.HexColor("#542B24")
COLOR_RUST = colors.HexColor("#9B4A32")
COLOR_GOLD = colors.HexColor("#C99A42")
COLOR_CREAM = colors.HexColor("#FFF8EC")
COLOR_ALMOND = colors.HexColor("#E8D5B5")
COLOR_DARK_TEXT = colors.HexColor("#2B1612")
COLOR_WHITE = colors.HexColor("#FFFFFF")
COLOR_LIGHT_ROW = colors.HexColor("#FCF9F3")


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print total page count."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        # Draw running header on pages > 1
        if self._pageNumber > 1:
            self.saveState()
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(COLOR_MAHOGANY)
            self.drawString(40, 805, "MithaiMart • Official Product Menu & Price Catalog")
            self.setFont("Helvetica", 8)
            self.setFillColor(COLOR_RUST)
            self.drawRightString(555, 805, "100% Pure Desi Ghee • Since 1957")
            self.setStrokeColor(COLOR_ALMOND)
            self.setLineWidth(0.6)
            self.line(40, 798, 555, 798)
            self.restoreState()

        # Running footer on every page
        self.saveState()
        self.setStrokeColor(COLOR_ALMOND)
        self.setLineWidth(0.6)
        self.line(40, 38, 555, 38)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(COLOR_MAHOGANY)
        self.drawString(40, 26, "MithaiMart Sweets & Savouries • Pan-India Courier Delivery • www.mithaimart.com")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(555, 26, page_str)
        self.restoreState()


def create_qr_image_flowable(url="http://localhost:5173/catalog", size=60):
    """Generates an in-memory QR code flowable for ReportLab."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=5,
            border=1,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#542B24", back_color="#FFF8EC")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return RLImage(buf, width=size, height=size)
    except Exception:
        return None


def generate_catalog_pdf():
    """Builds a beautiful PDF product catalog for MithaiMart and returns bytes."""
    buffer = io.BytesIO()

    # Document setup: A4 with 40pt side margins, 48pt top/bottom margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=48,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "CatalogTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=COLOR_MAHOGANY,
        alignment=0,  # Left
    )

    tagline_style = ParagraphStyle(
        "CatalogTagline",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12.5,
        textColor=COLOR_GOLD,
        alignment=0,
    )

    meta_style = ParagraphStyle(
        "CatalogMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=COLOR_DARK_TEXT,
        alignment=0,
    )

    qr_label_style = ParagraphStyle(
        "QRLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        textColor=COLOR_RUST,
        alignment=1,  # Center
    )

    category_heading_style = ParagraphStyle(
        "CatHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=COLOR_WHITE,
    )

    cat_desc_style = ParagraphStyle(
        "CatDesc",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=10,
        textColor=COLOR_CREAM,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10.5,
        textColor=COLOR_WHITE,
    )

    item_name_style = ParagraphStyle(
        "ItemName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10.5,
        textColor=COLOR_MAHOGANY,
    )

    item_state_style = ParagraphStyle(
        "ItemState",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        textColor=COLOR_RUST,
    )

    item_desc_style = ParagraphStyle(
        "ItemDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_DARK_TEXT,
    )

    price_style = ParagraphStyle(
        "ItemPrice",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_MAHOGANY,
    )

    elements = []

    # 1. Header Banner with QR Code
    gen_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
    header_left = [
        Paragraph("MithaiMart", title_style),
        Spacer(1, 2),
        Paragraph("AUTHENTIC DESI GHEE MITHAI & SAVOURIES • SINCE 1957", tagline_style),
        Spacer(1, 3),
        Paragraph(
            f"Official Price Catalog & Menu • Published {gen_date} • Pan-India Courier Delivery",
            meta_style,
        ),
    ]

    qr_flowable = create_qr_image_flowable("http://localhost:5173/catalog", size=58)
    if qr_flowable:
        qr_right = [
            qr_flowable,
            Spacer(1, 1),
            Paragraph("<b>SCAN TO VIEW ONLINE</b>", qr_label_style),
        ]
        header_table = Table([[header_left, qr_right]], colWidths=[435, 80])
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        elements.append(header_table)
    else:
        for item in header_left:
            elements.append(item)

    elements.append(Spacer(1, 8))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=1.2,
            color=COLOR_GOLD,
            spaceBefore=2,
            spaceAfter=10,
        )
    )

    # 2. Fetch Data from MongoDB
    db = get_db()
    categories = list(db.categories.find({"is_active": True}).sort("name", 1))

    # Preferred category ordering
    cat_order = [
        "Fresh Sweets",
        "Dry Fruits Sweets",
        "Bengali Sweets",
        "Chocolates",
        "Bakery & Boulangerie",
        "Namkeen",
        "Snacks",
        "Gifting",
    ]

    def get_order_key(cat):
        c_name = cat.get("name", "")
        for idx, target in enumerate(cat_order):
            if target.lower() in c_name.lower():
                return idx
        return 99

    categories.sort(key=get_order_key)

    for cat in categories:
        cat_id = cat["_id"]
        products = list(
            db.products.find({"category_id": cat_id, "is_active": True}).sort("name", 1)
        )
        if not products:
            continue

        # Category Header Banner Table
        cat_title_p = Paragraph(f"{cat['name'].upper()}", category_heading_style)
        cat_desc_text = cat.get("description", "") or "Handcrafted traditional recipes with pure ingredients."
        cat_desc_p = Paragraph(f"{len(products)} Delicacies • {cat_desc_text}", cat_desc_style)

        cat_header_table = Table(
            [[cat_title_p], [cat_desc_p]],
            colWidths=[515],
        )
        cat_header_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_MAHOGANY),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 1), (-1, 1), 1.5, COLOR_GOLD),
            ])
        )

        elements.append(Spacer(1, 8))
        elements.append(cat_header_table)

        # Products Table for this category
        table_data = [
            [
                Paragraph("<b>DELICACY & ORIGIN</b>", table_header_style),
                Paragraph("<b>DESCRIPTION & HIGHLIGHTS</b>", table_header_style),
                Paragraph("<b>AVAILABLE SIZES & PRICES (₹)</b>", table_header_style),
            ]
        ]

        # Table rows
        for p in products:
            name = p.get("name", "Mithai")
            state = p.get("state", "")
            state_label = f"• {state.upper()}" if state else "• HERITAGE RECIPE"
            desc = p.get("description", "") or "Authentic handcrafted delicacy."
            if len(desc) > 130:
                desc = desc[:127] + "..."

            # Formulate prices
            variants = p.get("variants", [])
            var_texts = []
            for v in variants:
                w = v.get("weight", "")
                pr = v.get("price", 0)
                var_texts.append(f"<b>{w}</b>: ₹{int(pr) if pr == int(pr) else pr}")

            prices_str = " | ".join(var_texts) if var_texts else "Enquire in store"

            col1 = [
                Paragraph(name, item_name_style),
                Paragraph(state_label, item_state_style),
            ]
            col2 = Paragraph(desc, item_desc_style)
            col3 = Paragraph(prices_str, price_style)

            table_data.append([col1, col2, col3])

        prod_table = Table(
            table_data,
            colWidths=[150, 205, 160],
            repeatRows=1,
        )

        table_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_RUST),
            ("TEXTCOLOR", (0, 0), (-1, 0), COLOR_WHITE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, COLOR_ALMOND),
        ]

        # Alternating background colors for readability
        for r_idx in range(1, len(table_data)):
            bg = COLOR_WHITE if r_idx % 2 == 1 else COLOR_LIGHT_ROW
            table_styles.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

        prod_table.setStyle(TableStyle(table_styles))
        elements.append(prod_table)
        elements.append(Spacer(1, 8))

    # Summary End Note with QR Code
    end_box = [
        [
            Paragraph(
                "<b>Scan & Order Online:</b> Scan the QR code above or visit <b>www.mithaimart.com</b>. "
                "For bulk celebration inquiries or customized wedding hampers, call <b>+91 98765 43210</b>. "
                "Pan-India courier delivery via BlueDart & DTDC with vacuum-sealed freshness guarantee.",
                meta_style,
            )
        ]
    ]
    end_table = Table(end_box, colWidths=[515])
    end_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_CREAM),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_GOLD),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    elements.append(Spacer(1, 6))
    elements.append(end_table)

    # Build PDF with custom NumberedCanvas
    doc.build(elements, canvasmaker=NumberedCanvas)

    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
