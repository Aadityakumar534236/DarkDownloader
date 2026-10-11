import re
import unittest


class FrontendStaticTests(unittest.TestCase):
    def read(self, path):
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()

    def test_theme_toggle_and_clipboard_denial_paths_exist(self):
        js = self.read("app/static/js/app.js")
        self.assertIn("toggleTheme", js)
        self.assertIn("Clipboard permission was denied", js)
        self.assertIn("Only HTTP and HTTPS URLs are accepted", js)

    def test_queue_history_and_preset_controls_exist(self):
        batch = self.read("app/templates/batch.html")
        history = self.read("app/templates/history.html")
        download = self.read("app/templates/download.html")
        self.assertIn("maximum of two concurrent jobs", batch)
        self.assertIn("will not transfer files", batch)
        self.assertIn("Clear history", history)
        self.assertIn("Audio Only", download)
        self.assertIn("/privacy", self.read("app/templates/base.html"))

    def test_home_is_separate_from_download_workspace(self):
        home = self.read("app/templates/home.html")
        download = self.read("app/templates/download.html")
        self.assertIn("Your media.", home)
        self.assertNotIn('id="analyzeForm"', home)
        self.assertIn('id="analyzeForm"', download)

    def test_mobile_css_and_focus_states_exist(self):
        css = self.read("app/static/css/styles.css")
        self.assertRegex(css, r"@media\s*\(max-width:\s*900px\)")
        self.assertRegex(css, r"@media\s*\(max-width:\s*640px\)")
        self.assertIn("focus-visible", css)
        self.assertIn("grid-template-columns: 1fr", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("@keyframes ribbon-drift", css)
        self.assertNotRegex(css, r"font-size:[^;]*vw")

    def test_no_fake_progress_percentages(self):
        js = self.read("app/static/js/app.js")
        self.assertNotRegex(js, r"Math\.random\(\).*%")
        self.assertIn("progressKnown", self.read("app/services/jobs.py"))

    def test_service_worker_caches_page_shell_but_skips_api(self):
        worker = self.read("app/static/service-worker.js")
        for route in ['"/download"', '"/batch"', '"/history"', '"/sources"']:
            self.assertIn(route, worker)
        self.assertIn('url.pathname.startsWith("/api/")', worker)

    def test_theme_bootstrap_respects_content_security_policy(self):
        base = self.read("app/templates/base.html")
        self.assertIn('src="/static/js/theme-init.js"', base)
        self.assertNotIn("<script>", base)


if __name__ == "__main__":
    unittest.main()
