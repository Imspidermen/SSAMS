#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                     🗂️  CODEBASE DOCUMENTER  v3.0                           ║
║                                                                              ║
║  Produces a single CODE.md that contains:                                    ║
║    • A pretty directory tree                                                 ║
║    • Every file's content in a fenced code block                             ║
║                                                                              ║
║  Two collection modes:                                                       ║
║    1 · Auto-discover  – scan the whole directory automatically               ║
║    2 · YAML config    – explicit file list via codebase.yaml                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import csv
import io
import os
import sys
import time
import argparse
import fnmatch
from datetime import datetime
from pathlib import Path
from typing import Iterator

# ── optional dependency (graceful fallback) ────────────────────────────────────
try:
    import yaml
    _YAML_AVAILABLE = True
except ImportError:
    _YAML_AVAILABLE = False


# ══════════════════════════════════════════════════════════════════════════════
#  ANSI COLOUR HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _supports_colour() -> bool:
    """Return True when the terminal is likely to render ANSI escape codes."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel = ctypes.windll.kernel32          # type: ignore[attr-defined]
            kernel.SetConsoleMode(kernel.GetStdHandle(-11), 7)
            return True
        except Exception:
            return False
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


_USE_COLOUR = _supports_colour()


class C:
    """Tiny ANSI palette – degrades silently when colour is unavailable."""
    _ESC = "\033["

    @staticmethod
    def _w(code: str, text: str) -> str:
        return f"{C._ESC}{code}m{text}{C._ESC}0m" if _USE_COLOUR else text

    # styles
    bold   = staticmethod(lambda t: C._w("1",    t))
    dim    = staticmethod(lambda t: C._w("2",    t))
    italic = staticmethod(lambda t: C._w("3",    t))

    # foreground colours
    red    = staticmethod(lambda t: C._w("31",   t))
    green  = staticmethod(lambda t: C._w("32",   t))
    yellow = staticmethod(lambda t: C._w("33",   t))
    blue   = staticmethod(lambda t: C._w("34",   t))
    purple = staticmethod(lambda t: C._w("35",   t))
    cyan   = staticmethod(lambda t: C._w("36",   t))
    white  = staticmethod(lambda t: C._w("37",   t))
    gray   = staticmethod(lambda t: C._w("90",   t))

    # combined
    header  = staticmethod(lambda t: C._w("1;36", t))   # bold cyan
    success = staticmethod(lambda t: C._w("1;32", t))   # bold green
    warn    = staticmethod(lambda t: C._w("1;33", t))   # bold yellow
    error   = staticmethod(lambda t: C._w("1;31", t))   # bold red
    path    = staticmethod(lambda t: C._w("36",   t))   # cyan


# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURATION  &  CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_NAME    = Path(__file__).name
DEFAULT_OUTPUT = "CODE.md"
DEFAULT_YAML   = "codebase.yaml"
CSV_PREVIEW    = 5          # max data rows shown for CSV files
MAX_FILE_BYTES = 5 * 1024 * 1024   # 5 MB hard cap per file

# Directories always pruned in auto-discover mode
_PRUNE_DIRS: frozenset[str] = frozenset({
    ".git", ".hg", ".svn",
    "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".tox", ".nox", ".eggs",
    ".venv", "venv", "env", ".env",
    "node_modules", "bower_components",
    ".idea", ".vscode",
    "dist", "build", "target", "out",
    "coverage", ".nyc_output",
    "htmlcov",
})

# File names always excluded in auto-discover mode
_PRUNE_FILES: frozenset[str] = frozenset({
    SCRIPT_NAME,
    DEFAULT_OUTPUT,
    DEFAULT_YAML,
    ".DS_Store", "Thumbs.db", "desktop.ini",
    ".gitkeep", ".gitignore", ".gitattributes",
})

# Extension → markdown fence language
_LANG_MAP: dict[str, str] = {
    ".py":     "python",    ".pyi":   "python",
    ".js":     "javascript",".mjs":   "javascript", ".cjs": "javascript",
    ".ts":     "typescript",".tsx":   "tsx",         ".jsx": "jsx",
    ".html":   "html",      ".htm":   "html",
    ".css":    "css",       ".scss":  "scss",        ".sass": "scss",
    ".json":   "json",      ".jsonc": "json",
    ".yaml":   "yaml",      ".yml":   "yaml",
    ".toml":   "toml",      ".ini":   "ini",         ".cfg":  "ini",
    ".md":     "markdown",  ".mdx":   "markdown",
    ".sh":     "bash",      ".bash":  "bash",        ".zsh":  "bash",
    ".fish":   "fish",
    ".sql":    "sql",
    ".xml":    "xml",       ".svg":   "xml",
    ".env":    "bash",
    ".c":      "c",         ".h":     "c",
    ".cpp":    "cpp",       ".cc":    "cpp",         ".cxx": "cpp",
    ".hpp":    "cpp",       ".hxx":   "cpp",
    ".cs":     "csharp",
    ".java":   "java",
    ".go":     "go",
    ".rs":     "rust",
    ".rb":     "ruby",
    ".php":    "php",
    ".swift":  "swift",
    ".kt":     "kotlin",    ".kts":   "kotlin",
    ".r":      "r",         ".rmd":   "r",
    ".dart":   "dart",
    ".lua":    "lua",
    ".perl":   "perl",      ".pl":    "perl",
    ".ex":     "elixir",    ".exs":   "elixir",
    ".erl":    "erlang",
    ".hs":     "haskell",
    ".scala":  "scala",
    ".clj":    "clojure",
    ".tf":     "hcl",       ".hcl":   "hcl",
    ".proto":  "protobuf",
    ".graphql":"graphql",   ".gql":   "graphql",
    ".csv":    "text",
    ".txt":    "text",
    ".log":    "text",
    ".rst":    "rst",
    ".tex":    "latex",
    ".makefile":"makefile", ".mk":    "makefile",
    ".dockerfile":"dockerfile",
    ".nginx":  "nginx",
    ".conf":   "nginx",
}

# Files whose names map to a language without needing an extension
_FILENAME_LANG_MAP: dict[str, str] = {
    "dockerfile":       "dockerfile",
    "makefile":         "makefile",
    "gemfile":          "ruby",
    "rakefile":         "ruby",
    "procfile":         "text",
    "vagrantfile":      "ruby",
    "jenkinsfile":      "groovy",
    ".env":             "bash",
    ".envrc":           "bash",
    "nginx.conf":       "nginx",
    "robots.txt":       "text",
    "requirements.txt": "text",
    "pipfile":          "toml",
}

# Binary extensions we never attempt to read
_BINARY_EXTENSIONS: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".tiff",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".obj", ".o", ".a",
    ".pyc", ".pyd", ".pyo",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".wav", ".ogg", ".avi", ".mov", ".mkv",
    ".db", ".sqlite", ".sqlite3",
    ".jar", ".war", ".ear",
    ".class",
    ".lock",         # often large / not human-readable
})


# ══════════════════════════════════════════════════════════════════════════════
#  TERMINAL UI HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _bar(char: str = "═", width: int = 62) -> str:
    return C.gray(char * width)


def _section(title: str) -> None:
    print(f"\n{_bar()}")
    print(f"  {C.header(title)}")
    print(_bar())


def _banner() -> None:
    """Print the startup banner."""
    lines = [
        "",
        _bar("═"),
        C.bold(C.cyan("       🗂️   CODEBASE DOCUMENTER   v3.0")),
        _bar("─"),
        C.dim("  Turns your project files into one clean CODE.md"),
        _bar("═"),
        "",
    ]
    print("\n".join(lines))


def _print_stats(
    mode:      str,
    n_files:   int,
    n_skipped: int,
    n_bytes:   int,
    elapsed:   float,
    output:    str,
) -> None:
    """Pretty-print a summary table after generation."""
    def _row(label: str, value: str) -> str:
        return f"  {C.dim(label + ':'): <30}  {value}"

    size_str = (
        f"{n_bytes / 1_048_576:.2f} MB" if n_bytes >= 1_048_576
        else f"{n_bytes / 1024:.1f} KB"  if n_bytes >= 1024
        else f"{n_bytes} B"
    )

    print(f"\n{_bar()}")
    print(f"  {C.success('✅  Generation complete!')}")
    print(_bar("─"))
    print(_row("Mode",             mode))
    print(_row("Files documented", C.green(str(n_files))))
    print(_row("Files skipped",    C.yellow(str(n_skipped)) if n_skipped else C.dim("0")))
    print(_row("Output size",      size_str))
    print(_row("Time elapsed",     f"{elapsed:.2f}s"))
    print(_row("Output file",      C.path(output)))
    print(_bar("═"))


def _spinner(msg: str) -> None:
    """Print a simple status line (no animation — keeps log-friendly output)."""
    print(f"  {C.blue('→')}  {msg}")


# ══════════════════════════════════════════════════════════════════════════════
#  MODE SELECTION
# ══════════════════════════════════════════════════════════════════════════════

def prompt_mode() -> int:
    """Interactive mode picker — returns 1 (auto) or 2 (yaml)."""
    print(f"  {C.bold('How would you like to select files?')}\n")
    print(f"  {C.cyan('[1]')}  {C.bold('Auto-discover')}  "
          f"{C.dim('— scan every file in this directory')}")
    print(f"  {C.cyan('[2]')}  {C.bold('YAML config')}    "
          f"{C.dim('— read file list from codebase.yaml')}")
    print()

    while True:
        try:
            raw = input(f"  {C.bold('Enter 1 or 2')} "
                        f"{C.dim('(or q to quit)')} › ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print(f"\n\n  {C.warn('Aborted.')}")
            sys.exit(0)

        if raw in ("q", "quit", "exit"):
            print(f"\n  {C.warn('Aborted.')}")
            sys.exit(0)
        if raw in ("1", "2"):
            return int(raw)

        print(f"  {C.error('⚠')}  Please enter {C.cyan('1')}, "
              f"{C.cyan('2')}, or {C.cyan('q')}.\n")


# ══════════════════════════════════════════════════════════════════════════════
#  YAML MODE
# ══════════════════════════════════════════════════════════════════════════════

def _require_yaml() -> None:
    if not _YAML_AVAILABLE:
        print(C.error(
            "\n  ❌  PyYAML is not installed.\n"
            "      Run:  pip install pyyaml\n"
        ))
        sys.exit(1)


def load_yaml(path: Path) -> dict:
    _require_yaml()
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def extract_paths(data) -> list[str]:
    """
    Recursively extract all file path strings from arbitrary yaml structures:
      - flat list, dict with 'files' key, nested dir→files dict …
    """
    paths: list[str] = []

    if isinstance(data, list):
        for item in data:
            paths.extend(extract_paths(item) if not isinstance(item, str) else [item])
    elif isinstance(data, dict):
        for key, value in data.items():
            paths.extend([key] if value is None else extract_paths(value))
    elif isinstance(data, str):
        paths.append(data)

    return paths


def resolve_yaml_paths(raw: list[str], base: Path) -> tuple[list[Path], int]:
    """Return (resolved_rel_paths, n_skipped)."""
    resolved: list[Path] = []
    skipped = 0

    for entry in raw:
        candidate = (base / entry.strip()).resolve()
        if candidate.exists():
            if candidate.is_file():
                resolved.append(candidate.relative_to(base))
            elif candidate.is_dir():
                for file in candidate.rglob("*"):
                    if file.is_file():
                        resolved.append(file.relative_to(base))
        else:
            print(f"  {C.warn('⚠')}  Not found, skipping : {C.path(entry.strip())}")
            skipped += 1

    return resolved, skipped


# ══════════════════════════════════════════════════════════════════════════════
#  AUTO-DISCOVER MODE
# ══════════════════════════════════════════════════════════════════════════════

def _matches_any(name: str, patterns: list[str]) -> bool:
    """Return True if *name* matches any shell-style glob pattern."""
    nl = name.lower()
    return any(fnmatch.fnmatch(nl, p.lower()) for p in patterns)


def auto_discover(
    base: Path,
    extra_exclude_dirs:  list[str] | None = None,
    extra_exclude_files: list[str] | None = None,
    include_hidden:      bool = False,
    include_binary:      bool = False,
) -> tuple[list[Path], int]:
    """
    Recursively walk *base* and collect every readable text file.

    Returns (sorted_rel_paths, n_skipped).
    """
    ex_dirs  = list(extra_exclude_dirs  or [])
    ex_files = list(extra_exclude_files or [])

    collected: list[Path] = []
    skipped = 0

    for root, dirs, files in os.walk(base, topdown=True):
        root_path = Path(root)

        # ── prune directories ──────────────────────────────────────
        dirs[:] = sorted(
            d for d in dirs
            if not (
                d in _PRUNE_DIRS
                or d.endswith(".egg-info")
                or (not include_hidden and d.startswith("."))
                or _matches_any(d, ex_dirs)
            )
        )

        # ── filter files ───────────────────────────────────────────
        for fname in sorted(files):
            if fname in _PRUNE_FILES:
                skipped += 1
                continue
            if not include_hidden and fname.startswith("."):
                skipped += 1
                continue
            if _matches_any(fname, ex_files):
                skipped += 1
                continue

            fpath = root_path / fname
            ext   = fpath.suffix.lower()

            if not include_binary and ext in _BINARY_EXTENSIONS:
                skipped += 1
                continue

            try:
                size = fpath.stat().st_size
            except OSError:
                skipped += 1
                continue

            if size > MAX_FILE_BYTES:
                print(
                    f"  {C.warn('⚠')}  Skipping large file "
                    f"({size / 1_048_576:.1f} MB): "
                    f"{C.path(str(fpath.relative_to(base)))}"
                )
                skipped += 1
                continue

            collected.append(fpath.relative_to(base))

    return collected, skipped


# ══════════════════════════════════════════════════════════════════════════════
#  DIRECTORY TREE RENDERER
# ══════════════════════════════════════════════════════════════════════════════

def build_tree(paths: list[Path]) -> dict:
    """Build a nested dict representing the directory tree."""
    tree: dict = {}
    for path in paths:
        node = tree
        for i, part in enumerate(path.parts):
            is_leaf = i == len(path.parts) - 1
            node    = node.setdefault(part, None if is_leaf else {})
            if not is_leaf and node is None:
                # was previously registered as a leaf; upgrade to dir
                node = {}
    return tree


def render_tree(tree: dict, prefix: str = "") -> list[str]:
    """Render the nested tree dict as pretty ASCII branch lines."""
    lines:   list[str] = []
    entries: list      = list(tree.items())

    for i, (name, subtree) in enumerate(entries):
        last      = i == len(entries) - 1
        connector = "└── " if last else "├── "
        lines.append(f"{prefix}{connector}{name}")
        if subtree:
            lines.extend(render_tree(subtree, prefix + ("    " if last else "│   ")))

    return lines


# ══════════════════════════════════════════════════════════════════════════════
#  FILE READING
# ══════════════════════════════════════════════════════════════════════════════

def get_language(path: Path) -> str:
    """Return the markdown fence identifier for a file."""
    by_name = _FILENAME_LANG_MAP.get(path.name.lower())
    if by_name:
        return by_name
    return _LANG_MAP.get(path.suffix.lower(), "text")


def _read_csv_preview(path: Path) -> str:
    """Return the first CSV_PREVIEW rows of a CSV with a truncation notice."""
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return f"[Error reading file: {exc}]"

    rows = list(csv.reader(io.StringIO(raw)))
    if not rows:
        return "[Empty CSV file]"

    header    = rows[:1]
    data      = rows[1:]
    preview   = header + data[:CSV_PREVIEW]

    buf = io.StringIO()
    csv.writer(buf).writerows(preview)
    result = buf.getvalue().rstrip("\r\n")

    if len(data) > CSV_PREVIEW:
        hidden  = len(data) - CSV_PREVIEW
        result += (
            f"\n\n# ⚠️  Preview — showing {CSV_PREVIEW} of "
            f"{len(data)} data rows ({hidden} rows hidden)."
        )
    return result


def read_file(path: Path) -> tuple[str, bool]:
    """
    Return (content_string, is_truncated).
    Handles CSV preview, binary detection, size cap, and encoding fallback.
    """
    ext = path.suffix.lower()

    if ext in _BINARY_EXTENSIONS:
        return "[Binary file — content not displayed]", False

    if ext == ".csv":
        return _read_csv_preview(path), False

    try:
        size = path.stat().st_size
    except OSError as exc:
        return f"[Cannot stat file: {exc}]", False

    if size > MAX_FILE_BYTES:
        mb = size / 1_048_576
        return f"[File too large to display: {mb:.1f} MB]", False

    # Try UTF-8, then fall back to latin-1 (never raises on any byte)
    for enc in ("utf-8", "latin-1"):
        try:
            content = path.read_text(encoding=enc)
            return content, False
        except UnicodeDecodeError:
            continue

    return "[Binary / unreadable file — content not displayed]", False


# ══════════════════════════════════════════════════════════════════════════════
#  MARKDOWN COMPOSER
# ══════════════════════════════════════════════════════════════════════════════

def _metadata_block(mode_label: str, base_dir: Path, n_files: int) -> list[str]:
    """Return the top-of-document metadata section."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        "# 🗂️ Codebase",
        "",
        "<!-- AUTO-GENERATED — do not edit by hand -->",
        "",
        "| Field | Value |",
        "| ----- | ----- |",
        f"| **Generated** | `{ts}` |",
        f"| **Source mode** | {mode_label} |",
        f"| **Base directory** | `{base_dir}` |",
        f"| **Total files** | {n_files} |",
        "",
    ]


def compose_markdown(
    rel_paths:  list[Path],
    base_dir:   Path,
    mode_label: str,
) -> tuple[list[str], int]:
    """
    Build the full CODE.md content lines.
    Returns (lines, n_bytes_total).
    """
    lines:   list[str] = []
    n_bytes: int       = 0

    # ── Metadata ──────────────────────────────────────────────────
    lines += _metadata_block(mode_label, base_dir, len(rel_paths))

    # ── Table of contents ─────────────────────────────────────────
    lines += ["## 📑 Table of Contents", ""]
    lines += ["1. [Project Structure](#-project-structure)"]
    lines += ["2. [File Contents](#-file-contents)"]
    lines += ["   " + f"- [{p.as_posix()}](#{_toc_anchor(p)})"
              for p in rel_paths]
    lines += [""]

    # ── Directory tree ────────────────────────────────────────────
    tree = build_tree(rel_paths)
    lines += ["## 📁 Project Structure", "", "```", "."]
    lines += render_tree(tree)
    lines += ["```", ""]

    # ── File contents ─────────────────────────────────────────────
    lines += ["## 📄 File Contents", ""]

    for rel in rel_paths:
        abs_path = base_dir / rel
        lang     = get_language(rel)
        content, _truncated = read_file(abs_path)
        n_bytes += len(content.encode("utf-8", errors="replace"))

        # terminal progress
        _log_file(rel)

        lines += [
            f"### `{rel.as_posix()}`",
            "",
            f"```{lang}",
            content,
            "```",
            "",
            "---",
            "",
        ]

    return lines, n_bytes


def _toc_anchor(path: Path) -> str:
    """Generate a GitHub-style markdown anchor for a file path."""
    slug = path.as_posix().replace("/", "").replace(".", "").replace("_", "-").lower()
    return slug


def _log_file(rel: Path) -> None:
    ext   = rel.suffix.lower()
    label = (
        f"{C.yellow(f'(CSV preview: first {CSV_PREVIEW} rows)')}"
        if ext == ".csv" else ""
    )
    print(f"  {C.green('✓')}  {C.path(str(rel))}  {label}")


# ══════════════════════════════════════════════════════════════════════════════
#  CLI ARGUMENT PARSER
# ══════════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="codebase",
        description="Generate a CODE.md documenting your entire codebase.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python codebase.py                        # interactive mode picker
  python codebase.py --mode auto            # non-interactive auto-discover
  python codebase.py --mode yaml            # non-interactive yaml mode
  python codebase.py --mode auto --hidden   # include hidden files
  python codebase.py --mode auto --output DOCS.md
  python codebase.py --mode auto --exclude-dir logs --exclude-dir tmp
  python codebase.py --mode auto --exclude-file "*.min.js"
        """,
    )

    p.add_argument(
        "--mode", "-m",
        choices=["auto", "yaml"],
        default=None,
        help="Collection mode: 'auto' (discover) or 'yaml' (codebase.yaml). "
             "Omit to get the interactive prompt.",
    )
    p.add_argument(
        "--yaml", "-y",
        default=DEFAULT_YAML,
        metavar="FILE",
        help=f"Path to the yaml config file (default: {DEFAULT_YAML}).",
    )
    p.add_argument(
        "--output", "-o",
        default=DEFAULT_OUTPUT,
        metavar="FILE",
        help=f"Output markdown file name (default: {DEFAULT_OUTPUT}).",
    )
    p.add_argument(
        "--hidden",
        action="store_true",
        help="Include hidden files/dirs (those starting with '.') in auto mode.",
    )
    p.add_argument(
        "--binary",
        action="store_true",
        help="Include binary files in auto mode (content shown as placeholder).",
    )
    p.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        metavar="PATTERN",
        dest="exclude_dirs",
        help="Extra directory name/pattern to exclude in auto mode. "
             "Repeatable: --exclude-dir logs --exclude-dir tmp",
    )
    p.add_argument(
        "--exclude-file",
        action="append",
        default=[],
        metavar="PATTERN",
        dest="exclude_files",
        help="Extra file name/pattern to exclude in auto mode. "
             "Repeatable: --exclude-file '*.min.js'",
    )
    p.add_argument(
        "--no-colour", "--no-color",
        action="store_true",
        help="Disable ANSI colour output.",
    )
    return p


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def generate(args: argparse.Namespace) -> None:
    global _USE_COLOUR
    if args.no_colour:
        _USE_COLOUR = False

    base_dir    = Path(__file__).parent.resolve()
    output_path = base_dir / args.output
    t_start     = time.perf_counter()

    _banner()

    # ── Decide mode ───────────────────────────────────────────────
    if args.mode is None:
        _section("SELECT MODE")
        mode_int = prompt_mode()
        mode     = "auto" if mode_int == 1 else "yaml"
    else:
        mode = args.mode

    # ── Collect files ─────────────────────────────────────────────
    n_skipped = 0

    if mode == "auto":
        _section("AUTO-DISCOVER")
        _spinner(f"Scanning:  {C.path(str(base_dir))}")
        if args.exclude_dirs:
            _spinner(f"Extra dir exclusions:  {', '.join(args.exclude_dirs)}")
        if args.exclude_files:
            _spinner(f"Extra file exclusions: {', '.join(args.exclude_files)}")
        print()

        rel_paths, n_skipped = auto_discover(
            base_dir,
            extra_exclude_dirs  = args.exclude_dirs  or None,
            extra_exclude_files = args.exclude_files or None,
            include_hidden      = args.hidden,
            include_binary      = args.binary,
        )
        mode_label = "Auto-discover"

    else:   # yaml
        _section("YAML CONFIG")
        yaml_path = base_dir / args.yaml

        if not yaml_path.exists():
            print(C.error(f"\n  ❌  YAML file not found: {yaml_path}\n"))
            sys.exit(1)

        _spinner(f"Loading:  {C.path(str(yaml_path))}")
        yaml_data = load_yaml(yaml_path)
        raw       = extract_paths(yaml_data)
        _spinner(f"{len(raw)} path(s) listed in yaml")
        print()

        rel_paths, n_skipped = resolve_yaml_paths(raw, base_dir)
        mode_label = f"YAML config (`{args.yaml}`)"

    # ── Guard ─────────────────────────────────────────────────────
    if not rel_paths:
        print(C.error("\n  ❌  No valid files found. Nothing to document.\n"))
        sys.exit(1)

    print(f"\n  {C.bold(str(len(rel_paths)))} file(s) will be documented.")

    # ── Compose markdown ──────────────────────────────────────────
    _section("PROCESSING FILES")
    md_lines, n_bytes = compose_markdown(rel_paths, base_dir, mode_label)

    # ── Write output ──────────────────────────────────────────────
    _section("WRITING OUTPUT")
    _spinner(f"Writing → {C.path(str(output_path))}")
    output_path.write_text("\n".join(md_lines), encoding="utf-8")

    # ── Summary ───────────────────────────────────────────────────
    elapsed = time.perf_counter() - t_start
    _print_stats(
        mode      = mode_label,
        n_files   = len(rel_paths),
        n_skipped = n_skipped,
        n_bytes   = n_bytes,
        elapsed   = elapsed,
        output    = str(output_path),
    )


def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()
    generate(args)


if __name__ == "__main__":
    main()