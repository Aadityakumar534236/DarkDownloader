import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

from ..services.errors import ApiError

BLOCKED_HOSTS = {"localhost", "localhost.localdomain"}
BLOCKED_NETS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),
]


@dataclass(frozen=True)
class UrlValidation:
    normalized_url: str
    host: str
    addresses: tuple


def validate_public_http_url(raw_url, config, resolver=None):
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ApiError("invalid_url", "Enter a URL to analyze.", 400)
    raw_url = raw_url.strip()
    if len(raw_url) > config.get("MAX_URL_LENGTH", 2048):
        raise ApiError("url_too_long", "The URL is longer than the configured limit.", 400)

    parsed = urlparse(raw_url)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise ApiError("blocked_scheme", "Only HTTP and HTTPS URLs are accepted.", 400)
    if parsed.username or parsed.password:
        raise ApiError("embedded_credentials", "URLs with embedded credentials are not accepted.", 400)
    if not parsed.hostname:
        raise ApiError("invalid_url", "The URL must include a hostname.", 400)

    host = parsed.hostname.rstrip(".").lower()
    if host in BLOCKED_HOSTS:
        raise ApiError("blocked_host", "Local and internal hosts are blocked.", 400)

    addresses = resolve_host(host, resolver=resolver)
    for address in addresses:
        reject_blocked_ip(address)

    netloc = host
    if parsed.port:
        netloc = f"{host}:{parsed.port}"
    normalized = urlunparse((parsed.scheme.lower(), netloc, parsed.path or "/", "", parsed.query, ""))
    return UrlValidation(normalized, host, tuple(str(item) for item in addresses))


def resolve_host(host, resolver=None):
    try:
        ipaddress.ip_address(host)
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass

    lookup = resolver or socket.getaddrinfo
    try:
        rows = lookup(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ApiError("dns_error", "The hostname could not be resolved.", 400) from exc

    addresses = []
    for row in rows:
        candidate = row[4][0]
        try:
            addresses.append(ipaddress.ip_address(candidate))
        except ValueError:
            raise ApiError("dns_error", "DNS returned an invalid address.", 400)
    if not addresses:
        raise ApiError("dns_error", "The hostname did not resolve to an address.", 400)
    return addresses


def reject_blocked_ip(address):
    ip = ipaddress.ip_address(address)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise ApiError("blocked_address", "The URL resolves to a blocked network address.", 400)
    for network in BLOCKED_NETS:
        if ip in network:
            raise ApiError("blocked_address", "The URL resolves to a blocked network address.", 400)
