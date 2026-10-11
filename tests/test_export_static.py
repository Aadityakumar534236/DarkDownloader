import tempfile
import unittest
from pathlib import Path

from scripts.export_static import export_site


class StaticExportTests(unittest.TestCase):
    def test_export_generates_pages_assets_and_clean_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "site"
            generated = export_site(output)

            expected_pages = {
                "index.html", "download.html", "batch.html", "history.html",
                "sources.html", "settings.html", "help.html", "privacy.html",
                "copyright.html", "404.html",
            }
            self.assertTrue(expected_pages.issubset({path.name for path in generated}))
            for asset in (
                "static/css/styles.css",
                "static/js/app.js",
                "static/js/theme-init.js",
                "static/icons/favicon.svg",
                "manifest.webmanifest",
                "service-worker.js",
            ):
                self.assertTrue((output / asset).is_file(), asset)

            for filename in expected_pages:
                html = (output / filename).read_text(encoding="utf-8")
                self.assertNotRegex(html, r"\{\{.*?\}\}|\{%.*?%\}")
                self.assertIn('content="true"', html)
            download = (output / "download.html").read_text(encoding="utf-8")
            self.assertIn('href="/download"', download)
            self.assertIn('href="/static/css/styles.css"', download)
            self.assertIn("no reachable HTTPS Flask API configured", (output / "static/js/app.js").read_text(encoding="utf-8"))
            settings = (output / "settings.html").read_text(encoding="utf-8")
            self.assertIn("Use a reachable HTTPS Flask API", settings)
            self.assertNotIn("Leave blank for this site", settings)

    def test_export_does_not_overwrite_unmarked_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "site"
            output.mkdir()
            sentinel = output / "keep.txt"
            sentinel.write_text("user data", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                export_site(output)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "user data")


if __name__ == "__main__":
    unittest.main()
