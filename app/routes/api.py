from flask import Blueprint, Response, current_app, jsonify, request

from ..providers.registry import get_registry
from ..services.errors import ApiError
from ..services.jobs import job_store
from ..security.urls import validate_public_http_url

api_bp = Blueprint("api", __name__)


def require_json():
    if not request.is_json:
        raise ApiError("invalid_json", "Expected application/json request body.", 415)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("invalid_json", "Malformed JSON object.", 400)
    return data


@api_bp.after_request
def apply_cors(response):
    origins = current_app.config.get("ALLOWED_ORIGINS", [])
    origin = request.headers.get("Origin")
    if origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@api_bp.route("/<path:unused>", methods=["OPTIONS"])
def cors_options(unused):
    return Response(status=204)


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "app": "DarkDownloader", "version": "0.1.0"})


@api_bp.get("/providers")
def providers():
    return jsonify({"providers": get_registry(current_app.config).as_public_list()})


@api_bp.post("/analyze")
def analyze():
    data = require_json()
    url = data.get("url", "")
    validation = validate_public_http_url(url, current_app.config)
    registry = get_registry(current_app.config)
    provider = registry.match(validation.normalized_url)
    result = provider.analyze(validation.normalized_url)
    return jsonify({"result": result})


@api_bp.post("/jobs")
def create_job():
    data = require_json()
    url = data.get("url", "")
    preset = data.get("preset", "best")
    validation = validate_public_http_url(url, current_app.config)
    registry = get_registry(current_app.config)
    provider = registry.match(validation.normalized_url)
    job = job_store.create(validation.normalized_url, preset, provider, request.remote_addr or "local")
    return jsonify({"job": job.to_public()}), 201


@api_bp.get("/jobs/<job_id>")
def get_job(job_id):
    job = job_store.get(job_id, request.remote_addr or "local")
    return jsonify({"job": job.to_public()})


@api_bp.post("/jobs/<job_id>/cancel")
def cancel_job(job_id):
    job = job_store.cancel(job_id, request.remote_addr or "local")
    return jsonify({"job": job.to_public()})


@api_bp.get("/jobs/<job_id>/download")
def download_job(job_id):
    job = job_store.get(job_id, request.remote_addr or "local")
    if not job.download_available:
        raise ApiError("download_unavailable", "No permitted download is available for this job.", 409)
    raise ApiError("not_implemented", "No real download adapter is enabled in this release.", 501)
