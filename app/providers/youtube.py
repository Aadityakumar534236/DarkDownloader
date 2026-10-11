from urllib.parse import parse_qs

from .base import Capability, Provider
from ..services.errors import ApiError


class YouTubeProvider(Provider):
    key = "youtube"
    name = "YouTube"
    host_patterns = ("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be")
    capabilities = (
        Capability("metadata_lookup", False, "Optional official Data API support is not configured in this release."),
        Capability("direct_media_download", False, "YouTube downloading is disabled without an explicitly permitted implementation."),
        Capability("format_listing", False, "The Data API does not grant media download or stream extraction permission."),
        Capability("subtitle_retrieval", False, "Not implemented without a permitted captions workflow."),
        Capability("audio_extraction", False, "Disabled; no stream extraction or circumvention is implemented."),
        Capability("format_conversion", False, "Disabled because no permitted YouTube media download exists."),
        Capability("official_download_handoff", True, "Open the official YouTube page or app for viewing and available official options."),
    )

    def __init__(self, config):
        self.api_key_configured = bool(config.get("YOUTUBE_API_KEY"))

    def matches(self, parsed_url):
        host = parsed_url.hostname or ""
        return host.lower() in self.host_patterns or host.lower().endswith(".youtube.com")

    def analyze(self, url):
        video_id = self._extract_video_id(url)
        return {
            "provider": self.key,
            "source": "YouTube",
            "title": "Unavailable",
            "duration": "Unavailable",
            "thumbnail": None,
            "formats": [],
            "subtitles": [],
            "download": {"available": False, "reason": "No permitted YouTube download adapter is enabled."},
            "officialUrl": url,
            "videoId": video_id,
            "capabilities": [cap.__dict__ for cap in self.capabilities],
            "notice": (
                "YouTube metadata, when configured through official APIs, does not imply permission "
                "to download video or audio. DarkDownloader does not extract protected streams."
            ),
        }

    def _extract_video_id(self, url):
        from urllib.parse import urlparse

        parsed = urlparse(url)
        if parsed.hostname == "youtu.be":
            return parsed.path.strip("/") or None
        query_id = parse_qs(parsed.query).get("v", [None])[0]
        return query_id
