from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"G:\SSAMS\SSAMS")
OUT = ROOT / "output" / "pdf" / "ssams-project-report.pdf"

NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1D72B8")
TEAL = colors.HexColor("#147D82")
INK = colors.HexColor("#243B53")
MUTED = colors.HexColor("#627D98")
LIGHT = colors.HexColor("#F0F4F8")
LINE = colors.HexColor("#D9E2EC")
AMBER = colors.HexColor("#C05621")


def para(text, style):
    return Paragraph(text, style)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 14 * mm, A4[0] - doc.rightMargin, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 9.5 * mm, "SSAMS Project Assessment")
    canvas.drawRightString(A4[0] - doc.rightMargin, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="SSAMS Project Assessment Report",
        author="Codex",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([__import__("reportlab.platypus", fromlist=["PageTemplate"]).PageTemplate(id="main", frames=[frame], onPage=footer)])

    styles = getSampleStyleSheet()
    title = ParagraphStyle("ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=NAVY, spaceAfter=8)
    subtitle = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=16, textColor=MUTED, spaceAfter=15)
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=20, textColor=NAVY, spaceBefore=14, spaceAfter=7)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=TEAL, spaceBefore=9, spaceAfter=4)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, spaceAfter=7)
    small = ParagraphStyle("Small", parent=body, fontSize=8.4, leading=11.5, textColor=MUTED)
    cell = ParagraphStyle("Cell", parent=body, fontSize=8.4, leading=11, spaceAfter=0)
    cell_head = ParagraphStyle("CellHead", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)
    finding = ParagraphStyle("Finding", parent=body, leftIndent=10, firstLineIndent=-10, bulletIndent=0, spaceAfter=5)

    story = []
    story += [
        para("Smart Student Attendance Management System", title),
        para("Project assessment report | Prepared 24 November 2026", subtitle),
    ]
    callout = Table([[para("<b>Overall assessment: strong internal or academic prototype.</b><br/>The system has a coherent multi-factor attendance workflow, sound TypeScript quality checks, and clear separation between client, API, database, and computer-vision service. It is not yet appropriate for high-assurance or punitive attendance decisions without stronger spoof resistance, deployment controls, and automated verification.", body)]], colWidths=[doc.width])
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEBEFORE", (0, 0), (0, 0), 4, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [callout, Spacer(1, 12)]

    story += [para("1. Project overview", h1)]
    story += [para("SSAMS is a role-based attendance platform for administrators, teachers, and students. It combines eligibility checks, geofencing, face verification, head-turn liveness, blink detection, attendance reporting, notifications, and audit logging. The design avoids a simple client-side attendance action: the backend tracks verification state and creates the final attendance record only after the required checks pass.", body)]
    story += [para("Architecture", h2)]
    arch = Table([
        [para("React web application", cell_head), para("Express API and PostgreSQL", cell_head), para("FastAPI CV service", cell_head)],
        [para("Role-specific dashboards, camera and location capture, route guards, reporting UI.", cell), para("Authentication, authorization, business rules, verification-state tracking, audit and reporting.", cell), para("Face detection, classical face comparison, liveness, and blink analysis.", cell)],
    ], colWidths=[doc.width / 3] * 3)
    arch.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [arch]

    story += [para("2. Functional scope", h1)]
    scope_data = [
        [para("Area", cell_head), para("Implemented capability", cell_head)],
        [para("Administration", cell), para("Student, teacher, subject, classroom, policy, reporting, and audit-log management.", cell)],
        [para("Teaching", cell), para("Subject allocation, time-limited session creation, live attendance view, and corrections.", cell)],
        [para("Student experience", cell), para("Dashboard, attendance history, face enrolment, notifications, profile, and attendance workflow.", cell)],
        [para("Attendance verification", cell), para("Location check, geofence evaluation, face match, liveness challenge, blink step, and atomic mark operation.", cell)],
        [para("Analytics", cell), para("Attendance trends, status breakdowns, subject results, reports, and recovery calculations.", cell)],
    ]
    scope = Table(scope_data, colWidths=[40 * mm, doc.width - 40 * mm])
    scope.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.55, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [scope, PageBreak()]

    story += [para("3. Security and data handling", h1)]
    story += [para("The backend implements JWT authentication, role-based API authorization, CSRF protection for cookie-authenticated writes, request validation, rate limiting, Helmet headers, CORS controls, structured logging, and transactional duplicate-attendance protection. Raw camera frames are documented as in-memory inputs to the CV service; face embeddings, rather than raw images, are stored by the core application.", body)]
    story += [para("The AI service is intended to be private and called only by the backend. This boundary must be enforced in deployment with network restrictions and preferably service-to-service authentication.", body)]

    story += [para("4. Quality verification", h1)]
    verify = Table([
        [para("Check", cell_head), para("Result", cell_head), para("Notes", cell_head)],
        [para("Backend tests", cell), para("26 passed", cell), para("Utility-focused Vitest coverage passed.", cell)],
        [para("Frontend tests", cell), para("77 passed", cell), para("Suite exited successfully; see warning below.", cell)],
        [para("Backend lint and build", cell), para("Passed", cell), para("ESLint and TypeScript compilation succeeded.", cell)],
        [para("Frontend lint and build", cell), para("Passed", cell), para("Production Vite build succeeded.", cell)],
        [para("AI-service tests", cell), para("Not run", cell), para("Local Python environment lacks FastAPI and pydantic-settings.", cell)],
    ], colWidths=[40 * mm, 30 * mm, doc.width - 70 * mm])
    verify.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.55, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [verify, Spacer(1, 7)]
    story += [para("The frontend test run emitted an asynchronous jsdom XHR AggregateError despite all tests passing. It is not a build blocker, but should be resolved to keep automated test output reliable.", small)]

    story += [para("5. Priority findings", h1)]
    findings = [
        ("High", "GPS is a useful location signal, not proof of physical presence. Browser-provided coordinates can be spoofed."),
        ("High", "The current face comparison is classical computer vision, and liveness/blink checks are not certified replay-attack defenses. They should not be the sole basis for high-stakes decisions."),
        ("High", "Session-specific attempt limits are not enforced across restarted verification sessions. The stored session value is not the value used by enforcement, and a new location check can begin another verification session."),
        ("Medium", "The AI service should be isolated from public traffic and protected by network rules or a service credential."),
        ("Medium", "The accepted geofence can include up to 30 m of GPS-accuracy tolerance, while the client displays only the base radius."),
        ("Medium", "There is no tracked CI or container/deployment configuration, and the AI suite was not executable in the current environment."),
    ]
    for level, text in findings:
        color = AMBER if level == "High" else BLUE
        story.append(para(f'<font color="{color.hexval()}"><b>{level}:</b></font> {text}', finding))

    story += [para("6. Recommended next steps", h1)]
    steps = [
        "Enforce a single attempt count keyed by session and student, using the attendance session's configured limit across all restarted verification flows.",
        "Deploy the CV service privately and add a backend-to-service authentication mechanism.",
        "Add integration tests for role authorization, expiry, duplicate records, retries, and the full attendance workflow against a test database.",
        "Create continuous integration to install dependencies and run backend, frontend, and AI-service checks on every change.",
        "For high-stakes deployment, use modern biometric models, calibrated thresholds, stronger device/location assurances, and a manual exception process.",
        "Clarify the effective geofence policy in the UI and remove the outstanding frontend test warning.",
    ]
    for i, item in enumerate(steps, 1):
        story.append(para(f"<b>{i}.</b> {item}", finding))

    story += [para("Conclusion", h1)]
    story += [para("SSAMS has a mature feature set and a well-organized implementation for an internal or academic attendance system. Its strongest qualities are the layered verification flow, role-aware interface, server-side enforcement, relational data model, and successful TypeScript quality checks. Its next phase should focus on security hardening, reproducible AI testing, and deployment automation before broader production use.", body)]
    story += [Spacer(1, 8), para("Assessment scope: source code, configuration, test execution, and generated project inventory available in the workspace. No source files were changed during the assessment.", small)]
    doc.build(story)


if __name__ == "__main__":
    build()
