import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .errors import ApiError


@dataclass
class Job:
    id: str
    url: str
    preset: str
    provider_key: str
    owner: str
    status: str = "queued"
    error: str = ""
    download_available: bool = False
    bytes_transferred: int = 0
    total_bytes: int = 0
    progress_known: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_public(self):
        return {
            "id": self.id,
            "url": self.url,
            "preset": self.preset,
            "provider": self.provider_key,
            "status": self.status,
            "error": self.error,
            "downloadAvailable": self.download_available,
            "bytesTransferred": self.bytes_transferred,
            "totalBytes": self.total_bytes if self.progress_known else None,
            "progressKnown": self.progress_known,
            "createdAt": self.created_at,
        }


class JobStore:
    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()

    def create(self, url, preset, provider, owner):
        job = Job(
            id=secrets.token_urlsafe(18),
            url=url,
            preset=preset,
            provider_key=provider.key,
            owner=owner,
            status="ready" if provider.key == "mock" else "failed",
            error="" if provider.key == "mock" else "No permitted download implementation is available.",
            download_available=False,
        )
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id, owner):
        with self._lock:
            job = self._jobs.get(job_id)
        if not job or job.owner != owner:
            raise ApiError("job_not_found", "Job not found.", 404)
        return job

    def cancel(self, job_id, owner):
        job = self.get(job_id, owner)
        if job.status in {"completed", "failed"}:
            return job
        job.status = "cancelled"
        return job


job_store = JobStore()
