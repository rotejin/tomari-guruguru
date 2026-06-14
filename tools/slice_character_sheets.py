from __future__ import annotations

import argparse
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path


SHEET_NAMES = {
    "A": "目開け_口とじ",
    "B": "目開け_口中間",
    "C": "目開け_口開け",
    "D": "目閉じ_口とじ",
    "E": "目閉じ_口中間",
    "F": "目閉じ_口開け",
}


def run(cmd: list[str], *, input_bytes: bytes | None = None) -> bytes:
    return subprocess.run(
        cmd,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    ).stdout


def find_source(source_dir: Path, sheet: str) -> Path:
    matches = sorted(source_dir.glob(f"{sheet}_*.png"))
    if not matches:
        matches = sorted(source_dir.glob(f"{sheet}*.png"))
    if not matches:
        raise FileNotFoundError(f"{sheet} sheet PNG was not found in {source_dir}")
    return matches[0]


def probe_size(path: Path) -> tuple[int, int]:
    out = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0:s=x",
            str(path),
        ]
    ).decode("utf-8", errors="replace").strip()
    w, h = out.split("x")
    return int(w), int(h)


def decode_rgba(path: Path) -> bytes:
    return run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-",
        ]
    )


class UnionFind:
    def __init__(self) -> None:
        self.parent: list[int] = []
        self.rank: list[int] = []

    def add(self) -> int:
        idx = len(self.parent)
        self.parent.append(idx)
        self.rank.append(0)
        return idx

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra = self.find(a)
        rb = self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1


@dataclass
class Component:
    area: int = 0
    min_x: int = 10**9
    min_y: int = 10**9
    max_x: int = -1
    max_y: int = -1
    runs: list[tuple[int, int, int]] = field(default_factory=list)

    def add_run(self, y: int, x0: int, x1: int) -> None:
        self.area += x1 - x0 + 1
        self.min_x = min(self.min_x, x0)
        self.min_y = min(self.min_y, y)
        self.max_x = max(self.max_x, x1)
        self.max_y = max(self.max_y, y)
        self.runs.append((y, x0, x1))

    @property
    def center(self) -> tuple[float, float]:
        return ((self.min_x + self.max_x) / 2, (self.min_y + self.max_y) / 2)


def alpha_runs_for_row(
    data: bytes,
    width: int,
    y: int,
    alpha_threshold: int,
    remove_gray_residue: bool,
    gray_alpha_max: int,
    gray_min: int,
    gray_max: int,
    gray_delta: int,
) -> list[tuple[int, int]]:
    row_start = y * width * 4
    runs: list[tuple[int, int]] = []

    def is_foreground(x_pos: int) -> bool:
        idx = row_start + x_pos * 4
        alpha = data[idx + 3]
        if alpha <= alpha_threshold:
            return False
        if remove_gray_residue and alpha <= gray_alpha_max:
            r = data[idx]
            g = data[idx + 1]
            b = data[idx + 2]
            mx = max(r, g, b)
            mn = min(r, g, b)
            mean = (r + g + b) // 3
            if mx - mn <= gray_delta and gray_min <= mean <= gray_max:
                return False
        return True

    x = 0
    while x < width:
        while x < width and not is_foreground(x):
            x += 1
        if x >= width:
            break
        start = x
        while x < width and is_foreground(x):
            x += 1
        runs.append((start, x - 1))
    return runs


def components_from_sheet(
    data: bytes,
    width: int,
    height: int,
    alpha_threshold: int,
    remove_gray_residue: bool,
    gray_alpha_max: int,
    gray_min: int,
    gray_max: int,
    gray_delta: int,
) -> dict[int, Component]:
    """Find 8-connected alpha components on the full source sheet.

    The source characters can exceed their nominal 900 px grid cell. Full-sheet
    connected components keep the whole character together and prevent
    neighboring characters from being copied into the wrong frame.
    """

    uf = UnionFind()
    all_runs: list[tuple[int, int, int, int]] = []  # y, x0, x1, provisional id
    prev: list[tuple[int, int, int]] = []  # x0, x1, provisional id

    for y in range(height):
        row_runs: list[tuple[int, int, int]] = []
        prev_i = 0
        for x0, x1 in alpha_runs_for_row(
            data,
            width,
            y,
            alpha_threshold,
            remove_gray_residue,
            gray_alpha_max,
            gray_min,
            gray_max,
            gray_delta,
        ):
            run_id = uf.add()
            while prev_i < len(prev) and prev[prev_i][1] < x0 - 1:
                prev_i += 1
            j = prev_i
            while j < len(prev) and prev[j][0] <= x1 + 1:
                uf.union(run_id, prev[j][2])
                j += 1
            row_runs.append((x0, x1, run_id))
            all_runs.append((y, x0, x1, run_id))
        prev = row_runs

    components: dict[int, Component] = {}
    for y, x0, x1, run_id in all_runs:
        root = uf.find(run_id)
        if root not in components:
            components[root] = Component()
        components[root].add_run(y, x0, x1)
    return components


def assign_components_to_cells(
    components: dict[int, Component],
    cell: int,
    min_area: int,
) -> dict[tuple[int, int], list[int]]:
    assignments: dict[tuple[int, int], list[int]] = {
        (row, col): [] for row in range(5) for col in range(5)
    }
    for comp_id, comp in components.items():
        if comp.area < min_area:
            continue
        cx, cy = comp.center
        col = min(4, max(0, round((cx - cell / 2) / cell)))
        row = min(4, max(0, round((cy - cell / 2) / cell)))
        assignments[(row, col)].append(comp_id)
    return assignments


def compose_cell_from_components(
    data: bytes,
    sheet_w: int,
    components: dict[int, Component],
    comp_ids: list[int],
    canvas_size: int,
    anchor_x: int,
    anchor_y: int,
) -> tuple[bytes, tuple[int, int], tuple[int, int, int, int], int]:
    if not comp_ids:
        raise ValueError("no component was assigned to this cell")

    min_x = min(components[comp_id].min_x for comp_id in comp_ids)
    min_y = min(components[comp_id].min_y for comp_id in comp_ids)
    max_x = max(components[comp_id].max_x for comp_id in comp_ids)
    max_y = max(components[comp_id].max_y for comp_id in comp_ids)
    area = sum(components[comp_id].area for comp_id in comp_ids)

    center_x = (min_x + max_x) / 2
    dst_x = round(anchor_x - center_x)
    dst_y = anchor_y - max_y
    canvas = bytearray(canvas_size * canvas_size * 4)

    for comp_id in comp_ids:
        for y, x0, x1 in components[comp_id].runs:
            dst_row = dst_y + y
            if dst_row < 0 or dst_row >= canvas_size:
                continue
            src_start = x0
            src_end = x1
            dst_start = dst_x + src_start
            dst_end = dst_x + src_end
            if dst_end < 0 or dst_start >= canvas_size:
                continue
            if dst_start < 0:
                src_start += -dst_start
                dst_start = 0
            if dst_end >= canvas_size:
                src_end -= dst_end - canvas_size + 1
                dst_end = canvas_size - 1
            src_i = (y * sheet_w + src_start) * 4
            dst_i = (dst_row * canvas_size + dst_start) * 4
            byte_count = (src_end - src_start + 1) * 4
            canvas[dst_i : dst_i + byte_count] = data[src_i : src_i + byte_count]

    return bytes(canvas), (dst_x, dst_y), (min_x, min_y, max_x, max_y), area


def cell_bbox(
    data: bytes,
    sheet_w: int,
    row: int,
    col: int,
    cell: int,
    alpha_threshold: int,
    y_start: int,
    y_end: int,
) -> tuple[int, int, int, int]:
    x0 = col * cell
    y0 = row * cell
    min_x = cell
    min_y = cell
    max_x = -1
    max_y = -1
    for y in range(y_start, y_end + 1):
        base = ((y0 + y) * sheet_w + x0) * 4
        for x in range(cell):
            if data[base + x * 4 + 3] > alpha_threshold:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < 0:
        raise ValueError(f"empty cell row={row} col={col}")
    return min_x, min_y, max_x, max_y


def active_row_range(
    data: bytes,
    sheet_w: int,
    row: int,
    col: int,
    cell: int,
    alpha_threshold: int,
    row_threshold: int,
    row_margin: int,
) -> tuple[int, int]:
    """Return the dominant vertical row cluster for a grid cell.

    Some source sheets let the next row's head overlap into the lower part of
    the previous 900 px cell. Selecting the strongest row cluster removes that
    unrelated lower-row fragment while preserving detached details that are
    horizontally separated but vertically aligned with the current character.
    """

    x0 = col * cell
    y0 = row * cell
    counts: list[int] = []
    for y in range(cell):
        base = ((y0 + y) * sheet_w + x0) * 4
        count = 0
        for x in range(cell):
            if data[base + x * 4 + 3] > alpha_threshold:
                count += 1
        counts.append(count)

    clusters: list[tuple[int, int, int]] = []
    start: int | None = None
    total = 0
    for i, count in enumerate(counts):
        if count >= row_threshold:
            if start is None:
                start = i
                total = 0
            total += count
        elif start is not None:
            clusters.append((start, i - 1, total))
            start = None
            total = 0
    if start is not None:
        clusters.append((start, cell - 1, total))

    if not clusters:
        non_empty = [i for i, count in enumerate(counts) if count > 0]
        if not non_empty:
            raise ValueError(f"empty cell row={row} col={col}")
        return max(0, non_empty[0] - row_margin), min(cell - 1, non_empty[-1] + row_margin)

    y_start, y_end, _ = max(clusters, key=lambda item: item[2])
    return max(0, y_start - row_margin), min(cell - 1, y_end + row_margin)


def compose_cell(
    data: bytes,
    sheet_w: int,
    row: int,
    col: int,
    cell: int,
    canvas_size: int,
    anchor_x: int,
    anchor_y: int,
    alpha_threshold: int,
    row_threshold: int,
    row_margin: int,
) -> tuple[bytes, tuple[int, int]]:
    active_y0, active_y1 = active_row_range(
        data,
        sheet_w,
        row,
        col,
        cell,
        alpha_threshold,
        row_threshold,
        row_margin,
    )
    min_x, _min_y, max_x, max_y = cell_bbox(
        data, sheet_w, row, col, cell, alpha_threshold, active_y0, active_y1
    )
    center_x = (min_x + max_x) / 2
    dst_x = round(anchor_x - center_x)
    dst_y = anchor_y - max_y

    # The current assets fit inside this range. Clipping keeps the script safe
    # if a future source sheet has a larger offset.
    canvas = bytearray(canvas_size * canvas_size * 4)
    src_x0 = col * cell
    src_y0 = row * cell
    copy_x0 = max(0, -dst_x)
    copy_y0 = max(active_y0, -dst_y)
    copy_x1 = min(cell, canvas_size - dst_x)
    copy_y1 = min(active_y1 + 1, canvas_size - dst_y)

    for y in range(copy_y0, copy_y1):
        src_base = ((src_y0 + y) * sheet_w + src_x0 + copy_x0) * 4
        dst_base = ((dst_y + y) * canvas_size + dst_x + copy_x0) * 4
        for x in range(copy_x0, copy_x1):
            src_i = src_base + (x - copy_x0) * 4
            if data[src_i + 3] > alpha_threshold:
                dst_i = dst_base + (x - copy_x0) * 4
                canvas[dst_i : dst_i + 4] = data[src_i : src_i + 4]

    return bytes(canvas), (dst_x, dst_y)


def encode_image(
    raw_rgba: bytes,
    out_path: Path,
    canvas_size: int,
    image_format: str,
    quality: int,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if image_format == "png":
        cmd = [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            f"{canvas_size}x{canvas_size}",
            "-i",
            "-",
            "-frames:v",
            "1",
            "-compression_level",
            "6",
            str(out_path),
        ]
    elif image_format == "webp":
        cmd = [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            f"{canvas_size}x{canvas_size}",
            "-i",
            "-",
            "-frames:v",
            "1",
            "-c:v",
            "libwebp",
            "-lossless",
            "1",
            "-compression_level",
            "6",
            str(out_path),
        ]
    else:
        raise ValueError(f"unsupported format: {image_format}")
    run(
        cmd,
        input_bytes=raw_rgba,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Slice 5x5 character sheets into anchored 1200x1200 frames."
    )
    parser.add_argument("--source", default="新キャラ資料", type=Path)
    parser.add_argument("--sheets-out", default="sheets", type=Path)
    parser.add_argument("--uploads-out", default="uploads", type=Path)
    parser.add_argument("--slices-out", default="slices3", type=Path)
    parser.add_argument("--cell", default=900, type=int)
    parser.add_argument("--canvas", default=1200, type=int)
    parser.add_argument("--anchor-x", default=600, type=int)
    parser.add_argument("--anchor-y", default=900, type=int)
    parser.add_argument("--alpha-threshold", default=64, type=int)
    parser.add_argument(
        "--remove-gray-residue",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Drop low-saturation semi-transparent gray background residue from source cutouts.",
    )
    parser.add_argument("--gray-residue-alpha-max", default=220, type=int)
    parser.add_argument("--gray-residue-min", default=90, type=int)
    parser.add_argument("--gray-residue-max", default=205, type=int)
    parser.add_argument("--gray-residue-delta", default=14, type=int)
    parser.add_argument("--row-threshold", default=20, type=int)
    parser.add_argument("--row-margin", default=8, type=int)
    parser.add_argument("--format", default="webp", choices=["png", "webp"])
    parser.add_argument("--quality", default=92, type=int)
    parser.add_argument("--jobs", default=1, type=int)
    parser.add_argument("--min-component-area", default=80, type=int)
    parser.add_argument(
        "--component-mode",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Use full-sheet connected components instead of simple grid-cell crops.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip frames that already exist, are non-empty, and are newer than the source sheet.",
    )
    args = parser.parse_args()

    args.sheets_out.mkdir(parents=True, exist_ok=True)
    args.uploads_out.mkdir(parents=True, exist_ok=True)
    args.slices_out.mkdir(parents=True, exist_ok=True)

    for sheet in SHEET_NAMES:
        src = find_source(args.source, sheet)
        w, h = probe_size(src)
        expected = args.cell * 5
        if (w, h) != (expected, expected):
            raise ValueError(f"{src} is {w}x{h}; expected {expected}x{expected}")

        shutil.copy2(src, args.sheets_out / f"{sheet}.png")
        shutil.copy2(src, args.uploads_out / src.name)

        pending: list[tuple[int, int, Path]] = []
        for row in range(5):
            for col in range(5):
                out = args.slices_out / sheet / f"r{row}c{col}.{args.format}"
                if args.resume and out.exists() and out.stat().st_size > 0:
                    if out.stat().st_mtime >= src.stat().st_mtime:
                        continue
                pending.append((row, col, out))

        print(f"{sheet}: {src.name} ({len(pending)} pending)")
        if not pending:
            continue

        data = decode_rgba(src)
        if args.component_mode:
            components = components_from_sheet(
                data,
                w,
                h,
                args.alpha_threshold,
                args.remove_gray_residue,
                args.gray_residue_alpha_max,
                args.gray_residue_min,
                args.gray_residue_max,
                args.gray_residue_delta,
            )
            assignments = assign_components_to_cells(
                components, args.cell, args.min_component_area
            )
            large_count = sum(
                1 for comp in components.values() if comp.area >= args.min_component_area
            )
            print(f"  components={len(components)} large={large_count}")
            for row in range(5):
                row_summary = []
                for col in range(5):
                    ids = assignments[(row, col)]
                    area = sum(components[i].area for i in ids)
                    row_summary.append(f"{len(ids)}:{area}")
                print(f"  row{row} comps(area) {' '.join(row_summary)}")

        jobs = max(1, args.jobs)
        futures = []
        executor = ThreadPoolExecutor(max_workers=jobs) if jobs > 1 else None
        for row, col, out in pending:
            if args.component_mode:
                raw, offset, bbox, area = compose_cell_from_components(
                    data,
                    w,
                    components,
                    assignments[(row, col)],
                    args.canvas,
                    args.anchor_x,
                    args.anchor_y,
                )
            else:
                raw, offset = compose_cell(
                    data,
                    w,
                    row,
                    col,
                    args.cell,
                    args.canvas,
                    args.anchor_x,
                    args.anchor_y,
                    args.alpha_threshold,
                    args.row_threshold,
                    args.row_margin,
                )
                bbox = (col * args.cell, row * args.cell, (col + 1) * args.cell - 1, (row + 1) * args.cell - 1)
                area = 0
            if executor:
                futures.append((out, offset, executor.submit(encode_image, raw, out, args.canvas, args.format, args.quality)))
            else:
                encode_image(raw, out, args.canvas, args.format, args.quality)
                print(f"  {out.as_posix()} offset={offset} bbox={bbox} area={area}")

        if executor:
            try:
                for out, offset, future in futures:
                    future.result()
                    print(f"  {out.as_posix()} offset={offset}")
            finally:
                executor.shutdown(wait=True)


if __name__ == "__main__":
    main()
