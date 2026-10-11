from dataclasses import dataclass

from ..services.errors import ApiError


@dataclass(frozen=True)
class Capability:
    key: str
    supported: bool
    note: str


class Provider:
    key = "unsupported"
    name = "Unsupported"
    host_patterns = ()
    capabilities = ()

    def public_info(self):
        return {
            "key": self.key,
            "name": self.name,
            "hosts": list(self.host_patterns),
            "capabilities": [cap.__dict__ for cap in self.capabilities],
        }

    def matches(self, parsed_url):
        return False

    def analyze(self, url):
        raise ApiError(
            "provider_not_supported",
            "This provider is not supported by a permitted adapter.",
            422,
        )
