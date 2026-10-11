import json
import socket
import unittest
from unittest.mock import patch

from app import create_app
from app.config import TestConfig
from app.security.urls import validate_public_http_url
from app.services.errors import ApiError
from app.services.jobs import JobStore
from app.providers.mock_provider import MockProvider


def resolver_for(*addresses):
    def _resolver(host, port, type=socket.SOCK_STREAM):
        return [(socket.AF_INET6 if ":" in item else socket.AF_INET, socket.SOCK_STREAM, 6, "", (item, 0)) for item in addresses]
    return _resolver


class DarkDownloaderTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    def test_app_starts_and_health(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_frontend_assets_load(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/static/css/styles.css").status_code, 200)
        self.assertEqual(self.client.get("/static/js/app.js").status_code, 200)
        self.assertEqual(self.client.get("/static/js/theme-init.js").status_code, 200)
        self.assertEqual(self.client.get("/manifest.webmanifest").status_code, 200)

    def test_workspace_tools_have_separate_pages(self):
        home = self.client.get("/").get_data(as_text=True)
        self.assertIn("Your media.", home)
        self.assertNotIn('id="analyzeForm"', home)
        for path, marker in [("/download", 'id="analyzeForm"'), ("/batch", 'id="queueList"'),
                             ("/history", 'id="historyList"'), ("/settings", 'id="defaultPreset"'),
                             ("/help", 'id="runDiagnostics"'), ("/sources", 'id="providersList"'),
                             ("/privacy", "Your data stays yours."), ("/copyright", "Use media responsibly.")]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(marker, response.get_data(as_text=True))

    def test_navigation_routes_and_unknown_page(self):
        response = self.client.get("/download")
        body = response.get_data(as_text=True)
        for href in ['href="/"', 'href="/download"', 'href="/batch"', 'href="/history"', 'href="/sources"']:
            self.assertIn(href, body)
        self.assertEqual(self.client.get("/queue").status_code, 301)
        self.assertEqual(self.client.get("/missing-page").status_code, 404)

    def test_csp_allows_only_configured_valid_api_origins(self):
        class CspConfig(TestConfig):
            ALLOWED_ORIGINS = ["https://frontend.example", "https://bad.example;script-src 'unsafe-inline'"]

        response = create_app(CspConfig).test_client().get("/")
        policy = response.headers["Content-Security-Policy"]
        self.assertIn("connect-src 'self' https://frontend.example", policy)
        self.assertNotIn("bad.example", policy)

    def test_malformed_requests_are_controlled(self):
        response = self.client.post("/api/v1/analyze", data="not-json", content_type="text/plain")
        self.assertEqual(response.status_code, 415)
        self.assertIn("error", response.get_json())

    def test_empty_and_bad_urls_rejected(self):
        response = self.client.post("/api/v1/analyze", json={"url": ""})
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/v1/analyze", json={"url": "file:///c:/secret.txt"})
        self.assertEqual(response.status_code, 400)

    def test_unsupported_provider_rejected(self):
        response = self.client.post("/api/v1/analyze", json={"url": "https://93.184.216.34/"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["error"]["code"], "provider_not_supported")

    def test_youtube_download_never_generated(self):
        with patch("socket.getaddrinfo", resolver_for("93.184.216.34")):
            response = self.client.post("/api/v1/analyze", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
        self.assertEqual(response.status_code, 200)
        result = response.get_json()["result"]
        self.assertFalse(result["download"]["available"])
        self.assertEqual(result["formats"], [])
        self.assertIn("does not imply permission", result["notice"])

    def test_mock_provider_is_marked_fixture_only(self):
        with patch("socket.getaddrinfo", resolver_for("93.184.216.34")):
            response = self.client.post("/api/v1/analyze", json={"url": "https://example.com/darkdownloader-fixture/demo"})
        self.assertEqual(response.status_code, 200)
        result = response.get_json()["result"]
        self.assertEqual(result["provider"], "mock")
        self.assertFalse(result["download"]["available"])
        self.assertEqual(len(result["formats"]), 2)

    def test_ssrf_rejects_localhost_and_loopback(self):
        with self.assertRaises(ApiError):
            validate_public_http_url("http://localhost/", self.app.config)
        with self.assertRaises(ApiError):
            validate_public_http_url("http://127.0.0.1/", self.app.config)
        with self.assertRaises(ApiError):
            validate_public_http_url("http://[::1]/", self.app.config)

    def test_ssrf_rejects_private_and_link_local(self):
        for url in ["http://10.0.0.2/", "http://172.16.1.1/", "http://192.168.1.1/", "http://169.254.169.254/"]:
            with self.subTest(url=url):
                with self.assertRaises(ApiError):
                    validate_public_http_url(url, self.app.config)

    def test_ssrf_rejects_credentials_and_bad_scheme(self):
        with self.assertRaises(ApiError):
            validate_public_http_url("https://user:pass@example.com/", self.app.config)
        with self.assertRaises(ApiError):
            validate_public_http_url("ftp://example.com/file", self.app.config)

    def test_ssrf_rejects_blocked_dns_results(self):
        with self.assertRaises(ApiError):
            validate_public_http_url("https://safe.test/", self.app.config, resolver=resolver_for("192.168.0.5"))
        validation = validate_public_http_url("https://safe.test/path", self.app.config, resolver=resolver_for("93.184.216.34"))
        self.assertEqual(validation.host, "safe.test")

    def test_job_store_ids_cancel_and_ownership(self):
        store = JobStore()
        job = store.create("https://example.com/darkdownloader-fixture/demo", "best", MockProvider(), "a")
        self.assertGreater(len(job.id), 20)
        self.assertEqual(store.get(job.id, "a").status, "ready")
        with self.assertRaises(ApiError):
            store.get(job.id, "b")
        cancelled = store.cancel(job.id, "a")
        self.assertEqual(cancelled.status, "cancelled")

    def test_job_endpoint_no_fake_download(self):
        with patch("socket.getaddrinfo", resolver_for("93.184.216.34")):
            response = self.client.post("/api/v1/jobs", json={"url": "https://www.youtube.com/watch?v=abc", "preset": "best"})
        self.assertEqual(response.status_code, 201)
        job = response.get_json()["job"]
        self.assertEqual(job["status"], "failed")
        download = self.client.get(f"/api/v1/jobs/{job['id']}/download")
        self.assertEqual(download.status_code, 409)

    def test_providers_capabilities_control_ui(self):
        response = self.client.get("/api/v1/providers")
        self.assertEqual(response.status_code, 200)
        providers = response.get_json()["providers"]
        youtube = next(item for item in providers if item["key"] == "youtube")
        direct = next(cap for cap in youtube["capabilities"] if cap["key"] == "direct_media_download")
        self.assertFalse(direct["supported"])

    def test_service_worker_does_not_cache_api(self):
        response = self.client.get("/static/service-worker.js")
        body = response.get_data(as_text=True)
        self.assertIn('url.pathname.startsWith("/api/")', body)
        self.assertIn("return;", body)

    def test_no_secrets_in_env_example(self):
        with open(".env.example", "r", encoding="utf-8") as handle:
            body = handle.read()
        self.assertNotIn("sk-", body)
        self.assertIn("YOUTUBE_API_KEY=", body)


if __name__ == "__main__":
    unittest.main()
