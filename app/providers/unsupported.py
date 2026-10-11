from .base import Capability, Provider


class UnsupportedProvider(Provider):
    key = "unsupported"
    name = "Unsupported provider"
    host_patterns = ("*",)
    capabilities = (
        Capability("metadata_lookup", False, "No permitted adapter is enabled for this source."),
        Capability("direct_media_download", False, "Unsupported sources cannot be downloaded."),
        Capability("format_listing", False, "No format list is available."),
        Capability("subtitle_retrieval", False, "No subtitle access is available."),
        Capability("audio_extraction", False, "No extraction is available."),
        Capability("format_conversion", False, "No conversion is available."),
        Capability("official_download_handoff", False, "No official handoff is known for this source."),
    )
