"""Plugin registry for PDF result format plugins.

Usage:
    import plugins
    plugin = plugins.detect('results.pdf')   # -> PDFPlugin subclass or None
    plugins.list_plugins()                   # -> list of (name, description)
"""

from importlib import import_module
import pkgutil
from pathlib import Path

from .base import PDFPlugin, RESULT_COLUMNS  # re-export for convenience

_registry: list[type[PDFPlugin]] = []
_discovered = False


def register(cls: type[PDFPlugin]) -> type[PDFPlugin]:
    """Class decorator: add cls to the plugin registry."""
    _registry.append(cls)
    return cls


def _discover() -> None:
    """Import every module in this package so @register decorators fire."""
    global _discovered
    if _discovered:
        return
    _discovered = True
    pkg_dir = Path(__file__).parent
    for _, mod_name, _ in pkgutil.iter_modules([str(pkg_dir)]):
        if mod_name not in ('base',):
            import_module(f'plugins.{mod_name}')


def get_plugins() -> list[type[PDFPlugin]]:
    """Return all registered plugin classes (triggers discovery on first call)."""
    _discover()
    return list(_registry)


def get_plugin(name: str) -> type[PDFPlugin] | None:
    """Return the plugin with the given name, or None."""
    for p in get_plugins():
        if p.name == name:
            return p
    return None


def detect(pdf_path: str) -> type[PDFPlugin] | None:
    """Return the first registered plugin that claims it can handle the file."""
    for plugin in get_plugins():
        try:
            if plugin.can_handle(pdf_path):
                return plugin
        except Exception:
            pass
    return None


def list_plugins() -> list[tuple[str, str]]:
    """Return list of (name, description) for all registered plugins."""
    return [(p.name, p.description) for p in get_plugins()]


__all__ = [
    'PDFPlugin',
    'RESULT_COLUMNS',
    'register',
    'get_plugins',
    'get_plugin',
    'detect',
    'list_plugins',
]
