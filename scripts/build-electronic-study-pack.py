#!/usr/bin/env python3
"""Build the 2026 HR economist study-pack import bundle from the supplied PDFs.

The script fails on missing questions, answers, options, or referenced files. It
produces both a production bundle (PDF attachments included) and a Git-friendly
questions-only JSON file.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


TRUTH_100 = "2026中级经济师-人力-历年真题100题.pdf"
PRACTICE_199 = "2026中经-人力-知识点配题.pdf"
MASTER_200 = "中级经济师《人力资源管理》经典母题200题.pdf"
WARNINGS: list[str] = []


@dataclass(frozen=True)
class MaterialSpec:
    file_name: str
    material_id: str
    title: str
    category: str
    summary: str
    recommended_use: str
    estimated_minutes: int


@dataclass(frozen=True)
class OptionMarker:
    label: str
    start: int
    end: int


MATERIALS = (
    MaterialSpec(
        TRUTH_100,
        "hr-pack-truth-100-2026",
        "历年真题 100 题",
        "题库资料",
        "按单选、多选、案例分析题编排的历年真题练习，已同步整理为在线题库。",
        "先限时完成在线试卷，再回到 PDF 对照原版排版与考点来源。",
        180,
    ),
    MaterialSpec(
        PRACTICE_199,
        "hr-pack-knowledge-practice-2026",
        "知识点配题",
        "题库资料",
        "逐章梳理知识点并配套例题，共整理出 199 道可在线作答题目。",
        "每学完一个知识点就做对应例题，适合章节学习和即时巩固。",
        360,
    ),
    MaterialSpec(
        "2026年中级经济师《人力资源》高频考点精粹.pdf",
        "hr-pack-high-frequency-essence-2026",
        "高频考点精粹",
        "高频考点",
        "浓缩高频考点与易混内容，适合考前快速回看。",
        "完成一轮教材学习后使用，按章节标记不熟悉的考点。",
        45,
    ),
    MaterialSpec(
        "2026年中级经济师【人力】默写本.pdf",
        "hr-pack-dictation-book-2026",
        "人力资源默写本",
        "默写训练",
        "以留白和提示词进行主动回忆训练，适合强化概念、条件与公式。",
        "先遮住答案独立默写，再用配套笔记校正遗漏。",
        120,
    ),
    MaterialSpec(
        "中级-人力-学霸笔记.pdf",
        "hr-pack-scholar-notes-2026",
        "学霸笔记",
        "核心笔记",
        "覆盖人力资源管理主要章节的综合复习笔记。",
        "作为主线复习资料，配合题库按章节滚动复习。",
        150,
    ),
    MaterialSpec(
        "中级人力-简版思维导图.pdf",
        "hr-pack-mind-map-2026",
        "简版思维导图",
        "思维导图",
        "用导图串联章节结构和核心概念，适合建立全局知识框架。",
        "每章学习前先看结构，学习后再用导图复述知识链路。",
        35,
    ),
    MaterialSpec(
        "中级经济师-人力-三色笔记.pdf",
        "hr-pack-three-color-notes-2026",
        "人力资源三色笔记",
        "核心笔记",
        "通过颜色层级突出重点、关键词和易错点的系统笔记。",
        "二轮复习时使用，重点关注高亮定义、数字与例外情形。",
        120,
    ),
    MaterialSpec(
        MASTER_200,
        "hr-pack-master-200-2026",
        "经典母题 200 题",
        "题库资料",
        "按单选、多选和案例题编排的经典母题，已同步整理为在线题库。",
        "完成章节学习后整套训练，错题自动进入个人错题本。",
        300,
    ),
    MaterialSpec(
        "中经-人力-入门一本通.pdf",
        "hr-pack-starter-guide-2026",
        "人力资源入门一本通",
        "入门导读",
        "面向初学者的科目结构、学习重点与备考方法导读。",
        "零基础先读这一份，再进入笔记与章节练习。",
        50,
    ),
    MaterialSpec(
        "近 5 年中级经济师《人力》高频考点+经典真题汇总.pdf",
        "hr-pack-five-year-review-2026",
        "近 5 年高频考点与经典真题汇总",
        "高频考点",
        "将近五年高频方向与代表性真题集中呈现，适合冲刺复盘。",
        "考前按高频主题查漏补缺；其中题目保留在原 PDF 中查看。",
        40,
    ),
    MaterialSpec(
        "零基础全配尊享班学员专属学习计划-中长期（蓝版）.pdf",
        "hr-pack-long-term-plan-2026",
        "零基础中长期学习计划",
        "学习计划",
        "按阶段安排基础学习、强化练习与冲刺复习的中长期计划。",
        "先结合自己的考试日期调整周计划，再按阶段使用对应资料。",
        25,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--bundle-dir", type=Path, required=True)
    parser.add_argument("--questions-output", type=Path, required=True)
    return parser.parse_args()


def compact(value: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return " ".join(line for line in lines if line).strip()


def passage_text(value: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(path)
    if reader.is_encrypted:
        raise ValueError(f"Encrypted PDF is not supported: {path}")

    pages: list[str] = []
    for page_number, page in enumerate(reader.pages, 1):
        extracted = page.extract_text()
        if not extracted or not extracted.strip():
            raise ValueError(f"No extractable text on page {page_number}: {path.name}")
        cleaned_lines: list[str] = []
        for raw_line in unicodedata.normalize("NFKC", extracted).splitlines():
            line = raw_line.strip()
            if not line:
                cleaned_lines.append("")
                continue
            if re.fullmatch(r"\d{1,3}", line):
                continue
            if line in {"学员专用 请勿外泄", "环球网校学员专用", "环球网校学员专用 请勿外泄"}:
                continue
            if re.fullmatch(r"\d{1,3}环球网校学员专用", line):
                continue
            if line.startswith("课程咨询:"):
                continue
            line = line.replace("中级经济师《人力资源管理 》真题母题 200 题", "")
            if line:
                cleaned_lines.append(line)
        pages.append("\n".join(cleaned_lines))
    return "\n".join(pages)


def option_matches(body: str) -> list[OptionMarker]:
    # Most labels are punctuated, including questions whose options share one
    # line. A few source lines omit the punctuation, so those are added only
    # when the label is at the beginning of a line.
    found: list[OptionMarker] = []
    occupied: list[tuple[int, int]] = []
    for match in re.finditer(r"(?<![A-Za-z0-9])([A-E])\s*[.,、]\s*", body):
        found.append(OptionMarker(match.group(1), match.start(), match.end()))
        occupied.append((match.start(), match.end()))
    for match in re.finditer(r"(?m)^\s*([A-E])\s+", body):
        if any(start <= match.start() < end for start, end in occupied):
            continue
        found.append(OptionMarker(match.group(1), match.start(), match.end()))
    return sorted(found, key=lambda item: item.start)


def parse_options(body: str, answer_letters: set[str], context: str) -> tuple[str, list[dict]]:
    matches = option_matches(body)
    if len(matches) < 2:
        raise ValueError(f"{context}: found only {len(matches)} option marker(s)")

    labels = [match.label for match in matches]
    expected = list("ABCDE"[: len(labels)])
    if labels != expected:
        raise ValueError(f"{context}: option labels are {labels}, expected {expected}")

    prompt = compact(body[: matches[0].start])
    if not prompt:
        raise ValueError(f"{context}: empty question prompt")

    options: list[dict] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start if index + 1 < len(matches) else len(body)
        content = compact(body[match.end : end])
        if not content:
            raise ValueError(f"{context}: option {match.label} is empty")
        options.append({"label": match.label, "content": content})

    unknown_answers = answer_letters - set(labels)
    if unknown_answers:
        raise ValueError(f"{context}: answers reference missing options {sorted(unknown_answers)}")
    return prompt, options


def answer_letters(value: str, context: str) -> set[str]:
    letters = set(re.findall(r"[A-E]", value.upper()))
    if not letters:
        raise ValueError(f"{context}: no answer letters found in {value!r}")
    return letters


def make_question(
    *,
    exam_prefix: str,
    position: int,
    question_type: str,
    section: str,
    passage: str,
    prompt: str,
    explanation: str,
    labels_and_content: list[dict],
    correct_labels: set[str],
) -> dict:
    if question_type == "single" and len(correct_labels) != 1:
        raise ValueError(f"{exam_prefix} question {position}: single choice has {correct_labels}")
    if question_type == "multiple" and len(correct_labels) < 2:
        raise ValueError(f"{exam_prefix} question {position}: multiple choice has {correct_labels}")

    question_id = f"{exam_prefix}-q{position:03d}"
    options = []
    for option in labels_and_content:
        label = option["label"]
        options.append(
            {
                "id": f"{question_id}-{label.lower()}",
                "label": label,
                "content": option["content"],
                "correct": label in correct_labels,
            }
        )
    return {
        "id": question_id,
        "type": question_type,
        "section": section,
        "passage": passage,
        "prompt": prompt,
        "explanation": explanation,
        "points": 1 if section == "standard" and question_type == "single" else 2,
        "options": options,
    }


def case_passages(
    text: str,
    section_start: int,
    question_starts: list[int],
    heading_pattern: str,
) -> list[tuple[int, str]]:
    headings = list(re.finditer(heading_pattern, text[section_start:], re.M))
    result: list[tuple[int, str]] = []
    for heading in headings:
        absolute_end = section_start + heading.end()
        first_question = next((start for start in question_starts if start > absolute_end), None)
        if first_question is None:
            raise ValueError(f"Case heading has no following question: {heading.group(0)!r}")
        passage = passage_text(text[absolute_end:first_question])
        if not passage:
            raise ValueError(f"Case heading has no passage: {heading.group(0)!r}")
        result.append((first_question, passage))
    return result


def current_case_passage(passages: list[tuple[int, str]], question_start: int) -> str:
    eligible = [passage for start, passage in passages if start <= question_start]
    if not eligible:
        raise ValueError(f"No case passage found for question at offset {question_start}")
    return eligible[-1]


def parse_truth_100(text: str) -> dict:
    marker = re.compile(r"【(单选题|多选题|不定项选择题)-题号\s*(\d+)】")
    matches = list(marker.finditer(text))
    numbers = [int(match.group(2)) for match in matches]
    if numbers != list(range(1, 101)):
        raise ValueError(f"Truth 100 question sequence mismatch: {numbers}")

    case_section = text.find("三、案例分析题")
    if case_section < 0:
        raise ValueError("Truth 100 case section heading is missing")
    starts = [match.start() for match in matches]
    passages = case_passages(text, case_section, starts, r"^\s*\([一二三四五]\)\s*$")
    if len(passages) != 5:
        raise ValueError(f"Truth 100 expected 5 case passages, found {len(passages)}")

    # The supplied PDF references a transition matrix for questions 85-88, but
    # the table is absent from the rendered source pages. These facts are the
    # minimum recoverable values stated verbatim by the source explanations.
    repaired_passage = (
        "\n\n【原 PDF 缺失表格的可核对摘要】行政事务人员留在本岗位 80%、离职 20%，且没有向上晋升；"
        "生产操作人员留在本岗位 80%；生产经理和销售经理留在本岗位均为 90%。"
    )

    questions = []
    for index, match in enumerate(matches):
        number = int(match.group(2))
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end() : end]
        answer_match = re.search(r"【(?:环球网校)?参考答案】\s*([A-E,，、\s]+)", block)
        if not answer_match:
            raise ValueError(f"Truth 100 question {number}: answer marker missing")
        correct = answer_letters(answer_match.group(1), f"Truth 100 question {number}")
        prompt, options = parse_options(
            block[: answer_match.start()], correct, f"Truth 100 question {number}"
        )
        explanation_match = re.search(
            r"【(?:环球网校)?解析】\s*(.*?)(?=【考点来源】|$)", block[answer_match.end() :], re.S
        )
        if not explanation_match:
            raise ValueError(f"Truth 100 question {number}: explanation marker missing")
        explanation = compact(explanation_match.group(1))
        source_match = re.search(
            r"【考点来源】\s*(.*?)(?=\n\s*\([一二三四五]\)\s*$|$)",
            block[answer_match.end() :],
            re.S | re.M,
        )
        if source_match:
            explanation = f"{explanation}\n\n考点来源：{compact(source_match.group(1))}"

        marker_type = match.group(1)
        section = "case" if marker_type == "不定项选择题" else "standard"
        question_type = (
            "single"
            if marker_type == "单选题" or (section == "case" and len(correct) == 1)
            else "multiple"
        )
        passage = current_case_passage(passages, match.start()) if section == "case" else ""
        if 85 <= number <= 88:
            passage += repaired_passage
        questions.append(
            make_question(
                exam_prefix="hrtruth100v1",
                position=number,
                question_type=question_type,
                section=section,
                passage=passage,
                prompt=prompt,
                explanation=explanation,
                labels_and_content=options,
                correct_labels=correct,
            )
        )

    return {
        "id": "hr-truth-100-2026-v1",
        "title": "中级经济师·人力资源｜历年真题 100 题",
        "description": "60 道单选、20 道多选、20 道案例分析题。答案与解析仅在交卷后展示。",
        "durationMinutes": 90,
        "passingScore": 60,
        "status": "published",
        "questions": questions,
    }


def parse_practice_199(text: str) -> dict:
    marker = re.compile(r"【例题\s*(\d+)[:·](单选|多选|案例)】")
    matches = list(marker.finditer(text))
    if len(matches) != 195:
        raise ValueError(f"Knowledge practice expected 195 example blocks, found {len(matches)}")

    questions = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end() : end]
        if match.group(2) == "案例":
            internal_markers = list(re.finditer(r"(?m)^\s*([1-3])\.\s*", block))
            internal_numbers = [int(item.group(1)) for item in internal_markers]
            if internal_numbers != [1, 2, 3]:
                raise ValueError(
                    f"Knowledge practice case block {match.group(1)} has subquestions {internal_numbers}"
                )
            case_passage = passage_text(block[: internal_markers[0].start()])
            if not case_passage:
                raise ValueError(f"Knowledge practice case block {match.group(1)} has no passage")
            for subindex, internal in enumerate(internal_markers):
                position = len(questions) + 1
                internal_end = (
                    internal_markers[subindex + 1].start()
                    if subindex + 1 < len(internal_markers)
                    else len(block)
                )
                subblock = block[internal.end() : internal_end]
                answer_match = re.search(r"【答案】\s*([A-E,，、\s]+)", subblock)
                if not answer_match:
                    raise ValueError(
                        f"Knowledge practice case question {position}: answer marker missing"
                    )
                correct = answer_letters(
                    answer_match.group(1), f"Knowledge practice case question {position}"
                )
                prompt, options = parse_options(
                    subblock[: answer_match.start()],
                    correct,
                    f"Knowledge practice case question {position}",
                )
                explanation_match = re.search(
                    r"【(?:解析|解题思路)】\s*(.*)", subblock[answer_match.end() :], re.S
                )
                if not explanation_match:
                    raise ValueError(
                        f"Knowledge practice case question {position}: explanation marker missing"
                    )
                explanation = compact(explanation_match.group(1))
                if not explanation:
                    raise ValueError(
                        f"Knowledge practice case question {position}: empty explanation"
                    )
                questions.append(
                    make_question(
                        exam_prefix="hrpractice199v1",
                        position=position,
                        question_type="single" if len(correct) == 1 else "multiple",
                        section="case",
                        passage=case_passage,
                        prompt=prompt,
                        explanation=explanation,
                        labels_and_content=options,
                        correct_labels=correct,
                    )
                )
            continue

        position = len(questions) + 1
        answer_match = re.search(r"【答案】\s*([A-E,，、\s]+)", block)
        if not answer_match:
            raise ValueError(f"Knowledge practice question {position}: answer marker missing")
        correct = answer_letters(answer_match.group(1), f"Knowledge practice question {position}")
        prompt, options = parse_options(
            block[: answer_match.start()], correct, f"Knowledge practice question {position}"
        )
        explanation_match = re.search(
            r"【(?:解析|解题思路)】\s*(.*)", block[answer_match.end() :], re.S
        )
        if not explanation_match:
            raise ValueError(f"Knowledge practice question {position}: explanation marker missing")
        explanation_raw = explanation_match.group(1)
        heading = re.search(
            r"\n\s*(?:【(?:知识点|考点)\s*\d+】|第[一二三四五六七八九十]+章\s)",
            explanation_raw,
        )
        if heading:
            explanation_raw = explanation_raw[: heading.start()]
        explanation = compact(explanation_raw)
        if not explanation:
            raise ValueError(f"Knowledge practice question {position}: empty explanation")
        question_type = "single" if match.group(2) == "单选" else "multiple"
        questions.append(
            make_question(
                exam_prefix="hrpractice199v1",
                position=position,
                question_type=question_type,
                section="standard",
                passage="",
                prompt=prompt,
                explanation=explanation,
                labels_and_content=options,
                correct_labels=correct,
            )
        )

    return {
        "id": "hr-knowledge-practice-199-2026-v1",
        "title": "中级经济师·人力资源｜知识点配题 199 题",
        "description": "按章节知识点编排的 199 道例题，适合边学边练；答案与解析仅在交卷后展示。",
        "durationMinutes": 240,
        "passingScore": 60,
        "status": "published",
        "questions": questions,
    }


def parse_master_200(text: str) -> dict:
    marker = re.compile(r"(?m)^\s*(\d{1,3})[、.]")
    candidates = list(marker.finditer(text))
    matches: list[re.Match[str]] = []
    expected_number = 1
    for candidate in candidates:
        if int(candidate.group(1)) == expected_number:
            matches.append(candidate)
            expected_number += 1
    numbers = [int(match.group(1)) for match in matches]
    if numbers != list(range(1, 201)):
        raise ValueError(f"Master 200 question sequence mismatch: {numbers}")

    multi_section = text.find("二、多选题")
    case_section = text.find("三、案例题")
    if multi_section < 0 or case_section < 0:
        raise ValueError("Master 200 section headings are missing")
    starts = [match.start() for match in matches]
    passages = case_passages(text, case_section, starts, r"^\s*案例[一二三四五]\s*$")
    if len(passages) != 5:
        raise ValueError(f"Master 200 expected 5 case passages, found {len(passages)}")

    questions = []
    for index, match in enumerate(matches):
        number = int(match.group(1))
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end() : end]
        answer_match = re.search(r"参考答案[:：]\s*([A-E,，、\s]+)", block)
        if not answer_match:
            raise ValueError(f"Master 200 question {number}: answer marker missing")
        correct = answer_letters(answer_match.group(1), f"Master 200 question {number}")
        prompt, options = parse_options(
            block[: answer_match.start()], correct, f"Master 200 question {number}"
        )
        explanation_match = re.search(r"参考解析[:：]\s*(.*)", block[answer_match.end() :], re.S)
        if explanation_match:
            explanation_raw = explanation_match.group(1)
        else:
            explanation_raw = block[answer_match.end() :]
            if compact(explanation_raw):
                WARNINGS.append(
                    f"Master 200 question {number}: explanation text has no 参考解析 marker"
                )
            else:
                WARNINGS.append(
                    f"Master 200 question {number}: source provides an answer but no explanation"
                )
                explanation_raw = "原始资料未提供文字解析。"
        case_heading = re.search(r"\n\s*案例[一二三四五]\s*$", explanation_raw, re.M)
        if case_heading:
            explanation_raw = explanation_raw[: case_heading.start()]
        explanation = compact(explanation_raw)
        if not explanation:
            raise ValueError(f"Master 200 question {number}: empty explanation")

        if match.start() < multi_section:
            section = "standard"
            question_type = "single"
        elif match.start() < case_section:
            section = "standard"
            question_type = "multiple"
        else:
            section = "case"
            question_type = "single" if len(correct) == 1 else "multiple"
        passage = current_case_passage(passages, match.start()) if section == "case" else ""
        questions.append(
            make_question(
                exam_prefix="hrmaster200v1",
                position=number,
                question_type=question_type,
                section=section,
                passage=passage,
                prompt=prompt,
                explanation=explanation,
                labels_and_content=options,
                correct_labels=correct,
            )
        )

    return {
        "id": "hr-master-200-2026-v1",
        "title": "中级经济师·人力资源｜经典母题 200 题",
        "description": "120 道单选、60 道多选、20 道案例分析题。答案与解析仅在交卷后展示。",
        "durationMinutes": 180,
        "passingScore": 60,
        "status": "published",
        "questions": questions,
    }


def assert_unique_ids(content: dict) -> None:
    ids: list[str] = []
    ids.extend(item["id"] for item in content["materials"])
    ids.extend(item["id"] for item in content["assets"])
    for exam in content["exams"]:
        ids.append(exam["id"])
        for question in exam["questions"]:
            ids.append(question["id"])
            ids.extend(option["id"] for option in question["options"])
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        raise ValueError(f"Duplicate IDs: {duplicates}")


def write_json(path: Path, content: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_materials(source_dir: Path, files_dir: Path) -> tuple[list[dict], list[dict]]:
    materials: list[dict] = []
    assets: list[dict] = []
    files_dir.mkdir(parents=True, exist_ok=True)
    for spec in MATERIALS:
        source = source_dir / spec.file_name
        if not source.is_file():
            raise FileNotFoundError(f"Required source PDF is missing: {source}")
        target = files_dir / spec.file_name
        shutil.copy2(source, target)
        materials.append(
            {
                "id": spec.material_id,
                "title": spec.title,
                "summary": spec.summary,
                "content": (
                    f"# {spec.title}\n\n"
                    f"{spec.summary}\n\n"
                    "## 建议使用方式\n\n"
                    f"{spec.recommended_use}\n\n"
                    "## 原始资料\n\n"
                    "页面下方的“配套资料”保留了原始 PDF，可在电脑或手机中打开。"
                    "题库类资料若已结构化，会同时出现在“模拟考试”中；在线作答时不提前显示答案，交卷后统一查看解析。"
                ),
                "category": spec.category,
                "estimatedMinutes": spec.estimated_minutes,
                "status": "published",
            }
        )
        assets.append(
            {
                "id": f"{spec.material_id}-pdf",
                "materialId": spec.material_id,
                "role": "attachment",
                "title": f"{spec.title}（原始 PDF）",
                "source": f"files/{spec.file_name}",
            }
        )
    return materials, assets


def validate_question_counts(exams: Iterable[dict]) -> None:
    expected = {
        "hr-truth-100-2026-v1": 100,
        "hr-knowledge-practice-199-2026-v1": 199,
        "hr-master-200-2026-v1": 200,
    }
    actual = {exam["id"]: len(exam["questions"]) for exam in exams}
    if actual != expected:
        raise ValueError(f"Unexpected exam counts: {actual}")


def main() -> None:
    args = parse_args()
    source_dir = args.source_dir.resolve()
    bundle_dir = args.bundle_dir.resolve()
    questions_output = args.questions_output.resolve()

    for spec in MATERIALS:
        if not (source_dir / spec.file_name).is_file():
            raise FileNotFoundError(f"Required source PDF is missing: {source_dir / spec.file_name}")

    truth_exam = parse_truth_100(extract_pdf_text(source_dir / TRUTH_100))
    practice_exam = parse_practice_199(extract_pdf_text(source_dir / PRACTICE_199))
    master_exam = parse_master_200(extract_pdf_text(source_dir / MASTER_200))
    exams = [truth_exam, practice_exam, master_exam]
    validate_question_counts(exams)

    materials, assets = build_materials(source_dir, bundle_dir / "files")
    content = {"materials": materials, "assets": assets, "exams": exams}
    assert_unique_ids(content)
    write_json(bundle_dir / "content.json", content)

    questions_only = {"materials": [], "assets": [], "exams": exams}
    assert_unique_ids(questions_only)
    write_json(questions_output, questions_only)

    print(
        json.dumps(
            {
                "materials": len(materials),
                "assets": len(assets),
                "exams": len(exams),
                "questions": sum(len(exam["questions"]) for exam in exams),
                "bundle": str(bundle_dir / "content.json"),
                "questionsOutput": str(questions_output),
                "warnings": WARNINGS,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
