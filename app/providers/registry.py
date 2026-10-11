from urllib.parse import urlparse

from .base import Provider
from .mock_provider import MockProvider
from .unsupported import UnsupportedProvider
from .youtube import YouTubeProvider


class ProviderRegistry:
    def __init__(self, providers):
        self.providers = providers
        self.unsupported = UnsupportedProvider()

    def as_public_list(self):
        return [provider.public_info() for provider in self.providers + [self.unsupported]]

    def match(self, url):
        parsed = urlparse(url)
        for provider in self.providers:
            if provider.matches(parsed):
                return provider
        return self.unsupported


def get_registry(config):
    providers = [YouTubeProvider(config)]
    if config.get("ENABLE_MOCK_PROVIDER", False):
        providers.append(MockProvider())
    return ProviderRegistry(providers)
