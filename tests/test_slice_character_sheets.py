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


if __name__ == "__main__":
    unittest.main()
