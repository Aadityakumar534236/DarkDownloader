# Deployment Guide

## Cloudflare Pages Static Frontend

From the repository root on Windows, render the existing Jinja pages without starting Flask:

```powershell
.\.venv\Scripts\python.exe scripts\export_static.py
```

The generated, Git-trackable output is `site/`. In Cloudflare Pages Git settings, use Framework preset `None`, root directory `/`, build command `exit 0`, and build output directory `site`. Cloudflare Pages serves matching `.html` files at extensionless routes (for example, `download.html` at `/download`) and recognizes top-level `404.html` as the custom not-found page. See the [official Pages serving documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/).

This deploys only the static frontend. Browser-local preferences and history remain available, but API-backed analysis, provider lookup, diagnostics, and queue submission require a separately hosted, reachable HTTPS Flask backend. The local Windows Flask server is not made public by deploying these files. No real media download implementation is enabled.

## Local Production-Like Run

On Linux:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
FLASK_DEBUG=0 gunicorn "run:app" --bind 0.0.0.0:$PORT
```

On Windows, use Flask only for local development:

```bat
.venv\Scripts\python.exe run.py
```

## Free-Tier Reality

Before choosing a host, verify the provider's current official documentation for:

- Python runtime support.
- Whether a payment card is required.
- Free memory, CPU, bandwidth, build minutes, idle sleep, and outbound network limits.
- Persistent storage policy.
- Background job restrictions.
- HTTPS and custom domain rules.

If a platform cannot safely run the backend or disallows needed outbound networking, deploy only the static frontend and leave backend features unavailable. Do not fake downloads.

Checked on 2026-10-11:

| Host | Free Python backend | No-card fit | Important limits |
| --- | --- | --- | --- |
| Render | Yes, free web services support Python | Possible without adding a payment method, but services can suspend when included usage is exceeded | 15-minute idle spin-down, ephemeral filesystem, monthly included bandwidth/build limits, high outbound traffic suspension risk |
| PythonAnywhere | Yes, Flask web apps are supported | Best documented no-cost beginner path | One free web app, restricted outbound Internet, limited consoles/resources |
| Koyeb | Yes, one free web service | No, official FAQ says a credit card is required | 512 MB RAM, 0.1 vCPU, 2 GB SSD |

Sources: https://render.com/docs/free, https://render.com/docs/faq, https://www.pythonanywhere.com/pricing/, https://help.pythonanywhere.com/pages/WebAppBasics/, https://www.koyeb.com/docs/faqs/pricing.

## CORS

For split frontend/backend deployments, set:

```env
ALLOWED_ORIGINS=https://your-frontend.example
```

The browser Settings page can point to the API base URL.
