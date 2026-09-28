"""Compatibility entrypoint for existing Gunicorn and local commands."""
from wsgi import app
__all__ = ["app"]
