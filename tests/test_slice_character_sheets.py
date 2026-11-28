"""自分のキャラを作る道具（tools/slice_character_sheets.py）の検査。

    python -B -m unittest discover -s tests -p "test_*.py"

標準ライブラリだけで動き、ffmpeg は要らない（ffmpeg を呼ぶ所は、呼び出しの中身だけを見る）。
"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True  # tools/ に __pycache__ を作らない

TOOL = Path(__file__).resolve().parent.parent / "tools" / "slice_character_sheets.py"
spec = importlib.util.spec_from_file_location("slice_character_sheets", TOOL)
slicer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = slicer  # dataclass が、この名前でモジュールを探すため
spec.loader.exec_module(slicer)


class EncodeImageTest(unittest.TestCase):
    """WebP は既定で非可逆（--quality を使う）。--lossless の時だけ可逆。"""

    def encode(self, **kwargs) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(slicer, "run") as run:
            slicer.encode_image(b"\0" * 16, Path(tmp) / "out" / "r0c0.webp", 2, "webp", **kwargs)
            self.assertEqual(run.call_count, 1)
            return run.call_args.args[0]

    def test_webp_is_lossy_with_the_quality_by_default(self) -> None:
        cmd = self.encode(quality=85)
        self.assertEqual(cmd[cmd.index("-lossless") + 1], "0")
        self.assertEqual(cmd[cmd.index("-quality") + 1], "85")

    def test_webp_is_lossless_only_when_asked(self) -> None:
        cmd = self.encode(quality=85, lossless=True)
        self.assertEqual(cmd[cmd.index("-lossless") + 1], "1")
        self.assertNotIn("-quality", cmd)

    def test_png_does_not_use_webp_options(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(slicer, "run") as run:
            slicer.encode_image(b"\0" * 16, Path(tmp) / "r0c0.png", 2, "png", 92)
            cmd = run.call_args.args[0]
        self.assertNotIn("-lossless", cmd)
        self.assertNotIn("-quality", cmd)


class RunTest(unittest.TestCase):
    """ffmpeg・ffprobe が失敗した時は、その理由（stderr）を出す。"""

    def test_failure_shows_what_the_program_said(self) -> None:
        cmd = [sys.executable, "-c", "import sys; sys.stderr.write('Invalid data found'); sys.exit(3)"]
        with self.assertRaises(slicer.ToolError) as caught:
            slicer.run(cmd)
        self.assertIn("Invalid data found", str(caught.exception))
        self.assertIn("exit code 3", str(caught.exception))

    def test_missing_program_is_explained(self) -> None:
        with self.assertRaises(slicer.ToolError) as caught:
            slicer.run(["no-such-program-for-slice-test"])
        self.assertIn("not found", str(caught.exception))

    def test_success_returns_stdout(self) -> None:
        out = slicer.run([sys.executable, "-c", "import sys; sys.stdout.write('4500x4500')"])
        self.assertEqual(out, b"4500x4500")


class FindSourceTest(unittest.TestCase):
    def folder(self, *names: str) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        for name in names:
            (Path(tmp.name) / name).write_bytes(b"")
        return Path(tmp.name)

    def test_usual_name(self) -> None:
        src = self.folder("A_目開け_口とじ.png", "B_目開け_口中間.png")
        self.assertEqual(slicer.find_source(src, "A").name, "A_目開け_口とじ.png")

    def test_short_names_still_work(self) -> None:
        src = self.folder("A.png", "B-目開け.png")
        self.assertEqual(slicer.find_source(src, "A").name, "A.png")
        self.assertEqual(slicer.find_source(src, "B").name, "B-目開け.png")

    def test_other_files_that_only_start_with_the_letter_are_not_used(self) -> None:
        src = self.folder("ABC.png", "A2.png", "BG.png")
        for sheet in ("A", "B"):
            with self.subTest(sheet=sheet), self.assertRaises(slicer.ToolError) as caught:
                slicer.find_source(src, sheet)
            self.assertIn("was not found", str(caught.exception))

    def test_two_candidates_stop_instead_of_picking_one(self) -> None:
        src = self.folder("A_目開け_口とじ.png", "A_目開け_口とじ_old.png")
        with self.assertRaises(slicer.ToolError) as caught:
            slicer.find_source(src, "A")
        self.assertIn("A_目開け_口とじ_old.png", str(caught.exception))


class CopyUnlessSameTest(unittest.TestCase):
    def test_copy_onto_itself_is_skipped(self) -> None:
        # --source と --uploads-out が同じフォルダの時（Windows では PermissionError で止まっていた）
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "A_目開け_口とじ.png"
            path.write_bytes(b"sheet")
            slicer.copy_unless_same(path, Path(tmp) / "." / path.name)
            self.assertEqual(path.read_bytes(), b"sheet")

    def test_other_destination_is_copied(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "A_目開け_口とじ.png"
            src.write_bytes(b"sheet")
            dst = Path(tmp) / "sheets" / "A.png"
            dst.parent.mkdir()
            slicer.copy_unless_same(src, dst)
            self.assertEqual(dst.read_bytes(), b"sheet")


class MainArgumentsTest(unittest.TestCase):
    def setUp(self) -> None:
        # 出力先は全部、一時フォルダの中に向ける（止まらなかった時に、リポジトリの中に作らないため）
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.outs = [self.tmp / "sheets", self.tmp / "uploads", self.tmp / "slices"]

    def call_main(self, *args: str) -> None:
        argv = ["slice_character_sheets.py", "--source", str(self.tmp),
                "--sheets-out", str(self.outs[0]), "--uploads-out", str(self.outs[1]),
                "--slices-out", str(self.outs[2]), *args]
        with mock.patch.object(sys, "argv", argv):
            slicer.main()

    def test_missing_ffmpeg_stops_before_doing_anything(self) -> None:
        with mock.patch.object(slicer.shutil, "which", return_value=None), \
                mock.patch("sys.stderr"), \
                self.assertRaises(SystemExit) as caught:
            self.call_main()
        self.assertEqual(caught.exception.code, 1)
        self.assertFalse(any(out.exists() for out in self.outs))

    def test_quality_out_of_range_is_refused(self) -> None:
        with mock.patch("sys.stderr"), self.assertRaises(SystemExit) as caught:
            self.call_main("--quality", "101")
        self.assertEqual(caught.exception.code, 2)
        self.assertFalse(any(out.exists() for out in self.outs))


# ── 速くした走査が、前と同じ結果になるか ─────────────────────────────────────
# 前（画素ごとに Python で見ていた時）の実装を、そのまま写して比べる。

def _old_alpha_runs_for_row(data, width, y, alpha_threshold, remove_gray_residue,
                            gray_alpha_max, gray_min, gray_max, gray_delta):
    row_start = y * width * 4
    runs = []

    def is_foreground(x_pos):
        idx = row_start + x_pos * 4
        alpha = data[idx + 3]
        if alpha <= alpha_threshold:
            return False
        if remove_gray_residue and alpha <= gray_alpha_max:
            r, g, b = data[idx], data[idx + 1], data[idx + 2]
            if max(r, g, b) - min(r, g, b) <= gray_delta and gray_min <= (r + g + b) // 3 <= gray_max:
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


def _old_cell_bbox(data, sheet_w, row, col, cell, alpha_threshold, y_start, y_end):
    x0, y0 = col * cell, row * cell
    min_x = min_y = cell
    max_x = max_y = -1
    for y in range(y_start, y_end + 1):
        base = ((y0 + y) * sheet_w + x0) * 4
        for x in range(cell):
            if data[base + x * 4 + 3] > alpha_threshold:
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)
    if max_x < 0:
        raise ValueError(f"empty cell row={row} col={col}")
    return min_x, min_y, max_x, max_y


def _old_active_row_range(data, sheet_w, row, col, cell, alpha_threshold, row_threshold, row_margin):
    x0, y0 = col * cell, row * cell
    counts = []
    for y in range(cell):
        base = ((y0 + y) * sheet_w + x0) * 4
        counts.append(sum(1 for x in range(cell) if data[base + x * 4 + 3] > alpha_threshold))
    clusters, start, total = [], None, 0
    for i, count in enumerate(counts):
        if count >= row_threshold:
            if start is None:
                start, total = i, 0
            total += count
        elif start is not None:
            clusters.append((start, i - 1, total))
            start, total = None, 0
    if start is not None:
        clusters.append((start, cell - 1, total))
    if not clusters:
        non_empty = [i for i, count in enumerate(counts) if count > 0]
        if not non_empty:
            raise ValueError(f"empty cell row={row} col={col}")
        return max(0, non_empty[0] - row_margin), min(cell - 1, non_empty[-1] + row_margin)
    y_start, y_end, _ = max(clusters, key=lambda item: item[2])
    return max(0, y_start - row_margin), min(cell - 1, y_end + row_margin)


def _old_compose_cell(data, sheet_w, row, col, cell, canvas_size, anchor_x, anchor_y,
                      alpha_threshold, row_threshold, row_margin):
    active_y0, active_y1 = _old_active_row_range(
        data, sheet_w, row, col, cell, alpha_threshold, row_threshold, row_margin)
    min_x, _min_y, max_x, max_y = _old_cell_bbox(
        data, sheet_w, row, col, cell, alpha_threshold, active_y0, active_y1)
    dst_x = round(anchor_x - (min_x + max_x) / 2)
    dst_y = anchor_y - max_y
    canvas = bytearray(canvas_size * canvas_size * 4)
    src_x0, src_y0 = col * cell, row * cell
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
                canvas[dst_i: dst_i + 4] = data[src_i: src_i + 4]
    return bytes(canvas), (dst_x, dst_y)


def _random_rgba(rng, n_pixels):
    """透明・不透明・半透明の灰色・半透明の色が混ざった画素を作る。"""
    out = bytearray()
    for _ in range(n_pixels):
        kind = rng.random()
        if kind < 0.35:
            out += bytes((rng.randrange(256), rng.randrange(256), rng.randrange(256), 0))
        elif kind < 0.6:
            out += bytes((rng.randrange(256), rng.randrange(256), rng.randrange(256), 255))
        elif kind < 0.85:
            v = rng.randrange(70, 225)
            out += bytes((v, min(255, v + rng.randrange(0, 20)), v, rng.randrange(1, 255)))
        else:
            out += bytes((rng.randrange(256), rng.randrange(256), rng.randrange(256), rng.randrange(1, 255)))
    return bytes(out)


def _outcome(fn, *args):
    try:
        return fn(*args)
    except ValueError as exc:
        return ("ValueError", str(exc))


class FastScanTest(unittest.TestCase):
    """画素の走査を速くした（bytes.translate と find）物が、前と同じ結果になる。"""

    def test_row_runs_are_the_same_as_before(self) -> None:
        import random
        rng = random.Random(20261128)
        width, height = 97, 40
        data = _random_rgba(rng, width * height)
        settings = [
            (64, True, 220, 90, 205, 14),   # 既定
            (64, False, 220, 90, 205, 14),  # --no-remove-gray-residue
            (0, True, 254, 0, 255, 255),    # 端の値
            (200, True, 150, 90, 205, 14),  # gray_alpha_max がしきい値より小さい
            (32, True, 255, 50, 230, 30),
        ]
        for setting in settings:
            for y in range(height):
                with self.subTest(setting=setting, y=y):
                    self.assertEqual(slicer.alpha_runs_for_row(data, width, y, *setting),
                                     _old_alpha_runs_for_row(data, width, y, *setting))

    def test_grid_cell_helpers_are_the_same_as_before(self) -> None:
        import random
        rng = random.Random(7)
        cell = 13
        sheet_w = cell * 5
        # ところどころ空のセルも作る
        data = bytearray(_random_rgba(rng, sheet_w * sheet_w))
        for y in range(cell, 2 * cell):
            for x in range(cell, 2 * cell):
                data[(y * sheet_w + x) * 4 + 3] = 0
        data = bytes(data)
        for threshold in (0, 64, 200, 254):
            for row, col in ((0, 0), (1, 1), (2, 3), (4, 4)):
                with self.subTest(threshold=threshold, cell=(row, col)):
                    for y_range in ((0, cell - 1), (3, 7)):
                        self.assertEqual(
                            _outcome(slicer.cell_bbox, data, sheet_w, row, col, cell, threshold, *y_range),
                            _outcome(_old_cell_bbox, data, sheet_w, row, col, cell, threshold, *y_range))
                    for row_threshold, margin in ((2, 1), (9, 0), (14, 3)):
                        self.assertEqual(
                            _outcome(slicer.active_row_range, data, sheet_w, row, col, cell, threshold, row_threshold, margin),
                            _outcome(_old_active_row_range, data, sheet_w, row, col, cell, threshold, row_threshold, margin))
                    for canvas, ax, ay in ((20, 10, 15), (8, 4, 6), (20, -3, 30), (20, 25, -2)):
                        self.assertEqual(
                            _outcome(slicer.compose_cell, data, sheet_w, row, col, cell, canvas, ax, ay, threshold, 2, 1),
                            _outcome(_old_compose_cell, data, sheet_w, row, col, cell, canvas, ax, ay, threshold, 2, 1))


if __name__ == "__main__":
    unittest.main()
