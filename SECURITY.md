# Security

DarkDownloader starts from a deny-by-default provider model. A source is not downloadable unless an adapter explicitly declares and implements a permitted download capability.

## SSRF Controls

- Only `http` and `https` URLs are accepted.
- Credentials in URLs are rejected.
- Hostnames are normalized.
- Localhost and internal hostnames are blocked.
- IPv4 and IPv6 loopback, private, link-local, multicast, reserved, and unspecified ranges are rejected.
- DNS lookup results are validated before provider matching.
- Download redirect handling is not implemented in this release. Future download code must revalidate every redirect target and enforce a small redirect limit.
- Request size and URL length are bounded.

## Secrets

Use environment variables for secrets. Do not commit `.env`, tokens, cookies, authorization headers, signed URLs, or real user data.

## Production

Run with `FLASK_DEBUG=0`. Use HTTPS, restrictive CORS, and a production server such as Gunicorn on Linux. Flask's development server is for local development only.
