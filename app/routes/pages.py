from flask import Blueprint, current_app, redirect, render_template, send_from_directory

pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def index():
    return render_template("home.html", page="home", title="Your media. Your way.")


@pages_bp.get("/download")
def download():
    return render_template("download.html", page="download", title="Download from URL")


@pages_bp.get("/batch")
def batch():
    return render_template("batch.html", page="batch", title="Batch processing")


@pages_bp.get("/history")
def history():
    return render_template("history.html", page="history", title="Download history")


@pages_bp.get("/sources")
def sources():
    return render_template("sources.html", page="sources", title="Supported sources")


@pages_bp.get("/settings")
def settings():
    return render_template("settings.html", page="settings", title="Settings")


@pages_bp.get("/help")
def help_page():
    return render_template("help.html", page="help", title="Help and diagnostics")


@pages_bp.get("/privacy")
def privacy():
    return render_template("privacy.html", page="privacy", title="Privacy")


@pages_bp.get("/copyright")
def copyright_page():
    return render_template("copyright.html", page="copyright", title="Copyright")


@pages_bp.get("/queue")
def legacy_queue():
    return redirect("/batch", code=301)


@pages_bp.get("/install")
def legacy_install():
    return redirect("/settings#installation", code=301)


@pages_bp.get("/manifest.webmanifest")
def manifest():
    return send_from_directory(current_app.static_folder, "manifest.webmanifest")


@pages_bp.get("/service-worker.js")
def service_worker():
    response = send_from_directory(current_app.static_folder, "service-worker.js")
    response.headers["Cache-Control"] = "no-cache"
    return response
