#!/usr/bin/env python3
"""Strictly extract the administrator HR homework PDFs into quiz JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


QUESTION_HEADING = re.compile(
    r"(?m)^\s*(\d+)\.\s*【(单选题|多项选择题|案例分析题|不定项选择题)】"
)
ANSWER_HEADING = re.compile(r"(?m)^\s*(\d+)\.\s*正确答案[：:]")
OPTION_HEADING = re.compile(r"(?m)^[ \t]*([A-H])(?:[.．、:：])?[ \t]+")
WATERMARK = re.compile(r"唯一微信\s*[：:]\s*taoqi3211", re.I)
EXPECTED_COUNTS = (23, 15, 23, 23, 15, 20, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 18, 13)
QUESTION_ASSETS = {
    9: {
        "source_page": 6,
        "source_image_index": 0,
        "file_name": "chapter-09-organization-chart.jpg",
        "byte_length": 29574,
        "sha256": "7c75ea9352a9968df6f8d12f2c866e50cdc54fcd9dc3b6aeea1018f0840df008",
    },
    14: {
        "source_page": 6,
        "source_image_index": 0,
        "file_name": "chapter-14-markov-table.jpg",
        "byte_length": 31038,
        "sha256": "881eb285d7156b7ec3bba7d25f30d3464d95da3fb7b1113cff5c5e047031c5c9",
    },
}
ALLOWED_BLANK_TRAILING_CHAPTERS = {7, 9}


@dataclass(frozen=True)
class Marker:
    label: str
    start: int
    end: int


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--asset-output-dir", type=Path)
    return parser.parse_args()


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = WATERMARK.sub("", value)
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])", "", value)
    value = re.sub(r"\s+([,.;:!?，。；：！？])", r"\1", value)
    value = re.sub(r"(?<=[,.;:!?，。；：！？])\s+(?=[\u3400-\u9fff])", "", value)
    return value


def clean_extracted_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).replace("\r", "\n")
    return WATERMARK.sub("", value)


def read_pdf(path: Path) -> tuple[str, int]:
    reader = PdfReader(path)
    pages: list[str] = []
    total_pages = len(reader.pages)
    for page_number, page in enumerate(reader.pages, 1):
        text = clean_extracted_text(page.extract_text() or "")
        if not text.strip():
            # Chapters 7 and 9 contain a visually verified blank trailing page.
            # Empty pages inside the document still indicate an extraction fault.
            chapter_match = re.match(r"(\d{2})\.", path.name)
            chapter_number = int(chapter_match.group(1)) if chapter_match else None
            if (
                page_number == total_pages
                and chapter_number in ALLOWED_BLANK_TRAILING_CHAPTERS
            ):
                pages.append("")
                continue
            raise ValueError(f"{path.name}: page {page_number} has no extractable text")
        pages.append(text)
    return "\n".join(pages), total_pages


def option_markers(body: str, context: str) -> list[Marker]:
    candidates = [Marker(m.group(1), m.start(), m.end()) for m in OPTION_HEADING.finditer(body)]
    valid: list[list[Marker]] = []
    for start_index, candidate in enumerate(candidates):
        if candidate.label != "A":
            continue
        group = [candidate]
        expected_ord = ord("B")
        for item in candidates[start_index + 1 :]:
            if item.label == chr(expected_ord):
                group.append(item)
                expected_ord += 1
                continue
            if item.label == "A":
                break
            # A line beginning with an unexpected option-like letter after the
            # option block makes extraction ambiguous and must not be ignored.
            break
        if len(group) >= 2:
            valid.append(group)

    if not valid:
        labels = [item.label for item in candidates]
        raise ValueError(f"{context}: could not find a consecutive option block; markers={labels}")

    # Options are the final structured block before the next question. Prefer
    # the group that starts latest, then require every following marker to be
    # part of that group so accidental matches are visible.
    group = max(valid, key=lambda items: items[0].start)
    first_index = candidates.index(group[0])
    trailing = candidates[first_index:]
    if trailing != group:
        raise ValueError(
            f"{context}: ambiguous option markers after A; "
            f"expected={[item.label for item in group]}, trailing={[item.label for item in trailing]}"
        )
    return group


def split_prompt_options(body: str, context: str) -> tuple[str, list[tuple[str, str]]]:
    markers = option_markers(body, context)
    prompt = normalize(body[: markers[0].start])
    if not prompt:
        raise ValueError(f"{context}: question prompt is empty")
    options: list[tuple[str, str]] = []
    for index, marker in enumerate(markers):
        end = markers[index + 1].start if index + 1 < len(markers) else len(body)
        content = normalize(body[marker.end : end])
        if not content:
            raise ValueError(f"{context}: option {marker.label} is empty")
        options.append((marker.label, content))
    return prompt, options


def parse_answer(body: str, context: str) -> tuple[set[str], str]:
    match = re.match(r"\s*([A-H](?:\s*[,，、]\s*[A-H])*)\s*(?:\||解析[：:])", body)
    if not match:
        raise ValueError(f"{context}: malformed answer prefix: {normalize(body[:100])!r}")
    letters = set(re.findall(r"[A-H]", match.group(1)))
    explanation_match = re.search(r"解析[：:]\s*(.*)$", body, re.S)
    if not explanation_match:
        raise ValueError(f"{context}: explanation is missing")
    explanation = normalize(explanation_match.group(1))
    explanation = re.sub(r"^【参考解析】\s*", "", explanation)
    if not explanation:
        raise ValueError(f"{context}: explanation is empty")
    return letters, explanation


def common_case_passage(prompts: list[str], context: str) -> tuple[str, list[str]]:
    prefix = prompts[0]
    for prompt in prompts[1:]:
        end = 0
        for left, right in zip(prefix, prompt):
            if left != right:
                break
            end += 1
        prefix = prefix[:end]
    punctuation_positions = [prefix.rfind(mark) for mark in "。！？；：:"]
    boundary = max(punctuation_positions) + 1
    passage = prefix[:boundary].strip()
    if len(passage) < 10:
        raise ValueError(
            f"{context}: repeated case passage is too short ({len(passage)} chars); "
            f"common prefix={prefix[:160]!r}"
        )
    question_prompts = [prompt[boundary:].strip() for prompt in prompts]
    if any(not prompt for prompt in question_prompts):
        raise ValueError(f"{context}: case-specific question prompt is empty")
    return passage, question_prompts


def build_question(
    *,
    chapter_number: int,
    number: int,
    source_type: str,
    full_prompt: str,
    options: list[tuple[str, str]],
    correct_labels: set[str],
    explanation: str,
    passage: str = "",
    prompt: str | None = None,
) -> dict:
    labels = {label for label, _ in options}
    missing = correct_labels - labels
    if missing:
        raise ValueError(
            f"chapter {chapter_number} question {number}: answers reference missing options {sorted(missing)}"
        )
    if source_type == "单选题":
        question_type = "single"
    elif source_type == "多项选择题":
        question_type = "multiple"
    else:
        question_type = "single" if len(correct_labels) == 1 else "multiple"
    if question_type == "single" and len(correct_labels) != 1:
        raise ValueError(
            f"chapter {chapter_number} question {number}: single-choice answer is {sorted(correct_labels)}"
        )
    if question_type == "multiple" and len(correct_labels) < 2:
        raise ValueError(
            f"chapter {chapter_number} question {number}: multiple-choice answer is {sorted(correct_labels)}"
        )

    question_id = f"hr-hw-ch{chapter_number:02d}-q{number:03d}"
    return {
        "id": question_id,
        "type": question_type,
        "section": "case" if passage else "standard",
        "passage": passage,
        "prompt": prompt if prompt is not None else full_prompt,
        "explanation": explanation,
        "points": 1,
        "options": [
            {
                "id": f"{question_id}-{label.lower()}",
                "label": label,
                "content": content,
                "correct": label in correct_labels,
            }
            for label, content in options
        ],
    }


def parse_chapter(path: Path, chapter_number: int, expected_count: int) -> tuple[dict, int]:
    text, page_count = read_pdf(path)
    question_matches = list(QUESTION_HEADING.finditer(text))
    answer_matches = list(ANSWER_HEADING.finditer(text))
    question_numbers = [int(match.group(1)) for match in question_matches]
    answer_numbers = [int(match.group(1)) for match in answer_matches]
    expected_numbers = list(range(1, expected_count + 1))
    if question_numbers != expected_numbers:
        raise ValueError(f"{path.name}: question sequence is {question_numbers}, expected {expected_numbers}")
    if answer_numbers != expected_numbers:
        raise ValueError(f"{path.name}: answer sequence is {answer_numbers}, expected {expected_numbers}")

    first_answer = answer_matches[0].start()
    raw_questions: list[dict] = []
    for index, match in enumerate(question_matches):
        end = question_matches[index + 1].start() if index + 1 < len(question_matches) else first_answer
        context = f"{path.name} question {index + 1}"
        full_prompt, options = split_prompt_options(text[match.end() : end], context)
        answer_end = answer_matches[index + 1].start() if index + 1 < len(answer_matches) else len(text)
        correct_labels, explanation = parse_answer(
            text[answer_matches[index].end() : answer_end], context
        )
        raw_questions.append(
            {
                "number": index + 1,
                "source_type": match.group(2),
                "full_prompt": full_prompt,
                "options": options,
                "correct_labels": correct_labels,
                "explanation": explanation,
            }
        )

    case_indexes = [
        index
        for index, item in enumerate(raw_questions)
        if item["source_type"] in {"案例分析题", "不定项选择题"}
    ]
    if case_indexes:
        groups: list[list[int]] = [[case_indexes[0]]]
        for index in case_indexes[1:]:
            if index == groups[-1][-1] + 1:
                groups[-1].append(index)
            else:
                groups.append([index])
        for group_number, indexes in enumerate(groups, 1):
            passage, prompts = common_case_passage(
                [raw_questions[index]["full_prompt"] for index in indexes],
                f"{path.name} case group {group_number}",
            )
            for index, prompt in zip(indexes, prompts):
                raw_questions[index]["passage"] = passage
                raw_questions[index]["prompt"] = prompt

    questions = [
        build_question(chapter_number=chapter_number, **item)
        for item in raw_questions
    ]
    title_match = re.search(r"第\d+章-?(.*?)(?:\.pdf)?$", path.name)
    source_title = title_match.group(1) if title_match else path.stem
    source_title = source_title.replace("【新教材变动】", "").strip(" -")
    exam = {
        "id": f"hr-admin-homework-chapter-{chapter_number:02d}",
        "moduleId": "human-resources",
        "title": f"第 {chapter_number} 章 · {source_title}",
        "description": "管理员专属课后练习，逐题作答，不计成绩。",
        "durationMinutes": 25,
        "passingScore": 0,
        "seriesId": "hr-admin-homework-2026",
        "seriesTitle": "中级经济师 · 人力资源课后作业",
        "seriesDescription": "精讲班课后练习",
        "seriesOrder": 900,
        "paperOrder": chapter_number,
        "status": "draft",
        "questions": questions,
    }
    return exam, page_count


def extract_question_assets(pdfs: list[Path], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for chapter_number, asset in QUESTION_ASSETS.items():
        page_number = asset["source_page"]
        image_index = asset["source_image_index"]
        page = PdfReader(pdfs[chapter_number - 1]).pages[page_number - 1]
        if len(page.images) <= image_index:
            raise ValueError(
                f"chapter {chapter_number} page {page_number}: expected image index {image_index}, "
                f"found {len(page.images)} image(s)"
            )
        image = page.images[image_index]
        data = image.data
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != asset["byte_length"] or digest != asset["sha256"]:
            raise ValueError(
                f"chapter {chapter_number} question asset changed: "
                f"bytes={len(data)} sha256={digest}"
            )
        (output_dir / asset["file_name"]).write_bytes(data)


def main() -> None:
    parsed = args()
    pdfs = sorted(parsed.source_dir.glob("*.pdf"))
    if len(pdfs) != 19:
        raise ValueError(f"expected 19 PDF files, found {len(pdfs)} in {parsed.source_dir}")
    exams: list[dict] = []
    page_counts: list[int] = []
    for chapter_number, (path, expected_count) in enumerate(zip(pdfs, EXPECTED_COUNTS), 1):
        file_prefix = re.match(r"(\d{2})\.", path.name)
        if not file_prefix or int(file_prefix.group(1)) != chapter_number:
            raise ValueError(f"expected chapter {chapter_number:02d}, found {path.name}")
        exam, page_count = parse_chapter(path, chapter_number, expected_count)
        exams.append(exam)
        page_counts.append(page_count)

    output = {"materials": [], "exams": exams, "assets": []}
    parsed.output.parent.mkdir(parents=True, exist_ok=True)
    parsed.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if parsed.asset_output_dir:
        extract_question_assets(pdfs, parsed.asset_output_dir)
    summary = ", ".join(
        f"{index:02d}:{len(exam['questions'])}" for index, exam in enumerate(exams, 1)
    )
    print(
        f"wrote {parsed.output}: {len(exams)} chapters, "
        f"{sum(len(exam['questions']) for exam in exams)} questions, "
        f"{sum(page_counts)} source pages ({summary})"
    )


if __name__ == "__main__":
    main()
