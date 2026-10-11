import re
from urllib.parse import urlsplit

from flask import Flask, jsonify, render_template

from .config import Config
from .routes.api import api_bp
from .routes.pages import pages_bp
from .services.errors import ApiError


def create_app(config_object=Config):
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(config_object)
    app.config["MAX_CONTENT_LENGTH"] = app.config["REQUEST_SIZE_LIMIT"]

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api/v1")

    @app.after_request
    def set_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "clipboard-read=(self), notifications=(self), geolocation=()",
        )
        api_origins = []
        for origin in app.config.get("ALLOWED_ORIGINS", []):
            parsed = urlsplit(origin)
            if (
                re.fullmatch(r"https?://(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::[0-9]{1,5})?", origin)
                and parsed.scheme in {"http", "https"}
                and parsed.netloc
                and parsed.hostname
                and not parsed.username
                and not parsed.password
                and not parsed.path
                and not parsed.query
                and not parsed.fragment
            ):
                api_origins.append(origin)
        connect_sources = " ".join(["'self'", *api_origins])
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: https:; "
            f"style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src {connect_sources}",
        )
        return response

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return jsonify(error.to_dict()), error.status_code

    @app.errorhandler(404)
    def handle_not_found(error):
        if getattr(error, "description", "") == "api":
            return jsonify({"error": {"code": "not_found", "message": "Endpoint not found."}}), 404
        return render_template("not_found.html"), 404

    @app.errorhandler(413)
    def handle_too_large(error):
        return jsonify({"error": {"code": "request_too_large", "message": "Request body is too large."}}), 413

    @app.errorhandler(500)
    def handle_server_error(error):
        return jsonify({"error": {"code": "server_error", "message": "A server error occurred."}}), 500

    return app
