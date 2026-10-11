# DarkDownloader

DarkDownloader is a lightweight Flask and vanilla JavaScript media utility. Its interface separates the product introduction, URL analysis, batch queue, local history, provider capabilities, settings, and help into individual pages. Provider adapters control what the application can actually analyze or download.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Product home and links to tools |
| `/download` | Analyze a supported URL and inspect returned metadata/formats |
| `/batch` | Local queue for multiple URLs |
| `/history` | Browser-local history, search, and status filters |
| `/sources` | Live provider capability matrix from the API |
| `/settings` | Theme, defaults, notifications, and API URL preferences |
| `/help` | Browser and API diagnostics |
| `/privacy` | Data storage and retention details |
| `/copyright` | Source and copyright responsibilities |

The service worker caches these public page templates and static shell assets only. API responses and actual job downloads are excluded.

## Capabilities and limitations

| Provider | Metadata | Formats | Permitted download | Subtitles | Conversion | State |
| --- | --- | --- | --- | --- | --- | --- |
| Local mock fixture (`https://example.com/darkdownloader-fixture/...`) | Fixture only | Fixture only | No | Fixture metadata only | No | Implemented and tested; never returns media |
| YouTube | Not configured by default | No | No | No | No | Explicitly unavailable; no extraction or circumvention |
| Other providers | No | No | No | No | No | Unsupported response |

No real media download adapter is enabled. YouTube downloading is not supported by a permitted implementation. YouTube metadata access, if separately configured later, would not grant permission to download media. Format selections remain unavailable unless a real adapter supplies them.

The batch page currently submits analysis/job capability checks only; it does not transfer media.

## Requirements

- Python 3.10 or newer
- Flask from `requirements.txt`
- Node.js is only needed for JavaScript syntax checking, not to run the app
- FFmpeg is not required or bundled; no conversion is enabled

### Windows 10 setup

Open PowerShell in `C:\Users\Aaditi\DarkDownloader`:

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python run.py
```

Open `http://127.0.0.1:5000`. The project also includes `Start DarkDownloader.bat` for double-click startup. If Python 3.10 is not registered with the Windows Python launcher, create the environment with the installed Python executable instead:

```powershell
python -m venv .venv
```

### Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
node --check app\static\js\app.js
```

Tests use local fixtures and mocked DNS; they do not download media or depend on third-party sites.

## API

- `GET /api/v1/health`
- `GET /api/v1/providers`
- `POST /api/v1/analyze` with `{ "url": "https://..." }`
- `POST /api/v1/jobs` with `{ "url": "https://...", "preset": "best" }`
- `GET /api/v1/jobs/<job_id>`
- `POST /api/v1/jobs/<job_id>/cancel`
- `GET /api/v1/jobs/<job_id>/download`

Errors have the shape `{ "error": { "code": "...", "message": "..." } }`. The download endpoint reports unavailable unless a permitted operation is actually enabled.

## Security and privacy

- HTTP and HTTPS only; embedded credentials are rejected.
- Local, loopback, private, link-local, reserved, and internal IP destinations are blocked after DNS resolution.
- Requests are provider matched and there is no generic proxy endpoint.
- CORS is restricted to `ALLOWED_ORIGINS`.
- Keep real credentials in environment variables; `.env.example` contains placeholders only. `.gitignore` excludes `.env` and other local secret files.
- Queue URLs and preferences are held in browser local storage. New history rows store only the source hostname. Clear local data from the app or browser settings.
- No database, account system, or cross-device history is included.

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and [COPYRIGHT.md](COPYRIGHT.md).

## Production and hosting

Do not use Flask's development server for production. On a compatible Linux host, install the requirements and run:

```sh
gunicorn "run:app" --bind 0.0.0.0:$PORT
```

Set `SECRET_KEY`, `ALLOWED_ORIGINS`, request/job limits, and provider configuration through the host's environment settings. Serve over HTTPS. The API and frontend can be deployed on separate origins by setting the API base URL in Settings and adding the exact frontend origin to `ALLOWED_ORIGINS`; both CORS and the Content Security Policy use that allowlist.

Free hosting terms, card requirements, quotas, and outbound networking change. Verify a host's official current plan before relying on it. Do not expect permanent storage, always-on service, unlimited bandwidth, or large media transfer support from a free tier. This app currently has no real download provider, so do not deploy it as a working media downloader.

## Screenshots

For a GitHub README screenshot, run the app locally, capture the home page and the `/download` page at desktop and mobile widths, and add optimized PNG or WebP files under `docs/screenshots/`. Do not include real URLs, account details, or private content in screenshots.

## GitHub publication

This folder has been initialized as a local Git repository on `main`; it has no commits or configured remote. Review the tree and staged changes before committing. No license has been added. For a small permissively licensed project, MIT is a reasonable option, but choose and add a license only after confirming the intended terms.

After creating an empty public repository named `DarkDownloader` on GitHub, run these commands from the local checkout to publish the reviewed project:

```powershell
cd C:\Users\Aaditi\DarkDownloader
git add .
git status --short
git diff --cached --check
git commit -m "Prepare DarkDownloader for public release"
git remote add origin https://github.com/YOUR-USERNAME/DarkDownloader.git
git push -u origin main
```

Review `git status` and the staged changes before committing. Replace `YOUR-USERNAME` with your GitHub username. Do not stage `.env`, `.venv`, downloaded media, or private URLs. Publication is a separate action and has not been performed.
