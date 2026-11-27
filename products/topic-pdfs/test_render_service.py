import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("render-service.py")
SPEC = importlib.util.spec_from_file_location("topic_pdf_render_service", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def sample_manuscript():
    body = ("This is a developed explanatory paragraph describing the topic in practical language. "
            "It gives context, explains the reasoning behind the advice, and identifies an action the reader can take. ") * 4
    return {
        "title": "A Practical Guide to Growing Vegetables",
        "subtitle": "Plan a productive small garden",
        "author": "Bevan Shelton",
        "language": "English",
        "geography": "International",
        "version": "0.1-editorial-draft",
        "sections": [{"heading": f"Section {index}", "body": body} for index in range(1, 6)],
        "sources": [
            {"title": "Official growing guide", "publisher": "Public Agriculture Office", "url": "https://example.org/growing", "accessedAt": "2026-11-27", "supports": ["Plant spacing"]},
            {"title": "Soil research", "publisher": "Research Institute", "url": "https://example.org/soil", "accessedAt": "2026-11-27", "supports": ["Soil preparation"]},
        ],
    }


class RenderServiceTests(unittest.TestCase):
    def test_markdown_contains_draft_warning_and_sources(self):
        markdown = MODULE.manuscript_to_markdown(sample_manuscript())
        self.assertIn("EDITORIAL DRAFT", markdown)
        self.assertIn("NOT FOR SALE", markdown)
        self.assertIn("[S1]", markdown)
        self.assertIn("https://example.org/growing", markdown)

    def test_rejects_short_or_missing_sections(self):
        manuscript = sample_manuscript()
        manuscript["sections"] = [{"heading": "Too short", "body": "Short text"}]
        with self.assertRaises(ValueError):
            MODULE.manuscript_to_markdown(manuscript)

    def test_renders_pdf_with_draft_watermark(self):
        payload = MODULE.render_manuscript(sample_manuscript())
        self.assertTrue(payload.startswith(b"%PDF-"))
        self.assertGreater(len(payload), 1000)
        self.assertIn(b"EDITORIAL DRAFT", payload)

    def test_rejects_non_https_source(self):
        manuscript = sample_manuscript()
        manuscript["sources"][0]["url"] = "http://example.org/no"
        with self.assertRaises(ValueError):
            MODULE.manuscript_to_markdown(manuscript)


if __name__ == "__main__":
    unittest.main()
