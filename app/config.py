import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
    TESTING = False
    REQUEST_SIZE_LIMIT = int(os.environ.get("REQUEST_SIZE_LIMIT", "8192"))
    MAX_URL_LENGTH = int(os.environ.get("MAX_URL_LENGTH", "2048"))
    MAX_JOBS_PER_CLIENT = int(os.environ.get("MAX_JOBS_PER_CLIENT", "25"))
    DEFAULT_CONCURRENCY = min(int(os.environ.get("DEFAULT_CONCURRENCY", "1")), 2)
    MAX_DOWNLOAD_BYTES = int(os.environ.get("MAX_DOWNLOAD_BYTES", str(50 * 1024 * 1024)))
    ALLOWED_ORIGINS = [
        item.strip()
        for item in os.environ.get("ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    ]
    ENABLE_MOCK_PROVIDER = os.environ.get("ENABLE_MOCK_PROVIDER", "1") == "1"
    YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")


class TestConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret"
    ENABLE_MOCK_PROVIDER = True
