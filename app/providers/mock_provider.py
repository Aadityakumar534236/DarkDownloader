from .base import Capability, Provider


class MockProvider(Provider):
    key = "mock"
    name = "Local mock provider"
    host_patterns = ("example.com",)
    capabilities = (
        Capability("metadata_lookup", True, "Returns local test fixture metadata only."),
        Capability("direct_media_download", False, "Mock downloads are intentionally disabled."),
        Capability("format_listing", True, "Returns a small fixture list marked as mock data."),
        Capability("subtitle_retrieval", True, "Returns fixture subtitle metadata only."),
        Capability("audio_extraction", False, "No real media exists in the mock provider."),
        Capability("format_conversion", False, "Conversion is not enabled for fixture metadata."),
        Capability("official_download_handoff", False, "No external handoff is needed for mock fixtures."),
    )

    def matches(self, parsed_url):
        host = parsed_url.hostname or ""
        return host.lower() == "example.com" and parsed_url.path.startswith("/darkdownloader-fixture")

    def analyze(self, url):
        return {
            "provider": self.key,
            "source": "Local fixture",
            "title": "Mock Fixture - Not Real Media",
            "duration": "00:01:12",
            "thumbnail": None,
            "formats": [
                {"id": "mock-720-webm", "container": "WebM", "quality": "720p", "audio": True, "video": True, "bytes": 3200000},
                {"id": "mock-audio-m4a", "container": "M4A", "quality": "audio", "audio": True, "video": False, "bytes": 640000},
            ],
            "subtitles": [{"language": "en", "format": "vtt"}],
            "download": {"available": False, "reason": "Mock provider never produces downloadable media."},
            "capabilities": [cap.__dict__ for cap in self.capabilities],
            "notice": "This is deterministic fixture metadata for testing UI behavior only.",
        }
