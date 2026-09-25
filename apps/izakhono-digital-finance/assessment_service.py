#!/usr/bin/env python3
"""Protected assessment-bank loader and scorer.

Production answer keys are loaded from a runtime-mounted file, never from the public repository.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class AssessmentService:
    def __init__(self, bank_path: str | Path):
        self.bank_path = Path(bank_path)

    def available(self) -> bool:
        return self.bank_path.is_file()

    def _load(self) -> dict[str, Any]:
        if not self.available():
            raise ValueError("assessment_bank_not_configured")
        data = json.loads(self.bank_path.read_text(encoding="utf-8"))
        if data.get("schema") != "izakhono.digital.finance.question-bank.v1":
            raise ValueError("invalid_assessment_bank_schema")
        return data

    def _assessment(self, assessment_id: str) -> dict[str, Any]:
        bank = self._load()
        for assessment in bank.get("assessments", []):
            if assessment.get("id") == assessment_id:
                return assessment
        raise ValueError("assessment_not_found")

    def present(self, assessment_id: str) -> dict[str, Any]:
        assessment = self._assessment(assessment_id)
        questions = []
        for question in assessment.get("questions", []):
            questions.append(
                {
                    "id": question["id"],
                    "prompt": question["prompt"],
                    "options": list(question["options"]),
                    "domain": question.get("domain"),
                }
            )
        return {
            "id": assessment["id"],
            "title": assessment.get("title", assessment["id"]),
            "type": assessment.get("type", "assessment"),
            "questions": questions,
            "question_count": len(questions),
        }

    def score(self, assessment_id: str, answers: dict[str, Any]) -> dict[str, Any]:
        assessment = self._assessment(assessment_id)
        questions = assessment.get("questions", [])
        if not questions:
            raise ValueError("assessment_has_no_questions")

        correct = 0
        domain_totals: dict[str, int] = {}
        domain_correct: dict[str, int] = {}

        for question in questions:
            qid = question["id"]
            domain = question.get("domain") or "general"
            domain_totals[domain] = domain_totals.get(domain, 0) + 1
            expected = question["correct_option"]
            supplied = answers.get(qid)
            if supplied == expected:
                correct += 1
                domain_correct[domain] = domain_correct.get(domain, 0) + 1

        percent = round((correct / len(questions)) * 100)
        gaps = [
            domain
            for domain, total in domain_totals.items()
            if round((domain_correct.get(domain, 0) / total) * 100) < 70
        ]

        return {
            "assessment_id": assessment_id,
            "correct": correct,
            "total": len(questions),
            "percent": percent,
            "knowledge_gaps": gaps,
        }
