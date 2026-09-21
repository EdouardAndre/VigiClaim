#!/usr/bin/env python3
"""Evaluate the exported Custom Vision Docker endpoint on a validation split."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

import requests


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate a local Custom Vision Docker endpoint."
    )
    parser.add_argument(
        "--validation-root",
        default="data/raw/data3a/validation",
        help="Folder containing one subfolder per ground-truth class.",
    )
    parser.add_argument(
        "--endpoint",
        default="http://127.0.0.1:8080/image",
        help="Custom Vision Docker /image endpoint.",
    )
    parser.add_argument(
        "--metrics-output",
        default="reports/customvision-validation-metrics.json",
        help="Where to write JSON metrics.",
    )
    parser.add_argument(
        "--predictions-output",
        default="reports/customvision-validation-predictions.csv",
        help="Where to write per-image predictions.",
    )
    return parser.parse_args()


def label_from_folder(folder: Path) -> str:
    return folder.name.split("-", 1)[-1].strip().lower()


def collect_images(validation_root: Path) -> list[tuple[Path, str]]:
    items: list[tuple[Path, str]] = []
    for class_dir in sorted(path for path in validation_root.iterdir() if path.is_dir()):
        label = label_from_folder(class_dir)
        for path in sorted(class_dir.iterdir()):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                items.append((path, label))
    if not items:
        raise SystemExit(f"No validation images found under {validation_root}")
    return items


def predict(endpoint: str, path: Path) -> tuple[str, float, dict[str, float]]:
    with path.open("rb") as image_file:
        response = requests.post(
            endpoint,
            files={"imageData": (path.name, image_file)},
            timeout=60,
        )
    response.raise_for_status()
    payload = response.json()
    probabilities = {
        item["tagName"]: float(item["probability"])
        for item in payload.get("predictions", [])
    }
    if not probabilities:
        raise ValueError(f"No predictions returned for {path}")
    predicted_label, confidence = max(probabilities.items(), key=lambda item: item[1])
    return predicted_label, confidence, probabilities


def compute_metrics(
    labels: list[str], rows: list[dict[str, object]]
) -> dict[str, object]:
    total = len(rows)
    correct = sum(1 for row in rows if row["actual"] == row["predicted"])
    confusion = {
        actual: {predicted: 0 for predicted in labels}
        for actual in labels
    }
    for row in rows:
        confusion[str(row["actual"])][str(row["predicted"])] += 1

    by_class: dict[str, dict[str, float | int]] = {}
    for label in labels:
        tp = confusion[label][label]
        fp = sum(confusion[actual][label] for actual in labels if actual != label)
        fn = sum(confusion[label][predicted] for predicted in labels if predicted != label)
        support = sum(confusion[label].values())
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )
        by_class[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support,
        }

    macro_f1 = sum(float(values["f1"]) for values in by_class.values()) / len(labels)
    weighted_f1 = sum(
        float(values["f1"]) * int(values["support"])
        for values in by_class.values()
    ) / total
    return {
        "total": total,
        "correct": correct,
        "accuracy": correct / total if total else 0.0,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "labels": labels,
        "class_distribution": dict(Counter(str(row["actual"]) for row in rows)),
        "by_class": by_class,
        "confusion_matrix": confusion,
    }


def main() -> int:
    args = parse_args()
    validation_root = Path(args.validation_root)
    items = collect_images(validation_root)
    labels = sorted({label for _, label in items})

    rows: list[dict[str, object]] = []
    for index, (path, actual) in enumerate(items, start=1):
        predicted, confidence, probabilities = predict(args.endpoint, path)
        rows.append(
            {
                "path": str(path),
                "actual": actual,
                "predicted": predicted,
                "confidence": confidence,
                **{f"prob_{label}": probabilities.get(label, 0.0) for label in labels},
            }
        )
        if index % 25 == 0 or index == len(items):
            print(f"Evaluated {index}/{len(items)} images")

    metrics = compute_metrics(labels, rows)
    metrics_output = Path(args.metrics_output)
    predictions_output = Path(args.predictions_output)
    metrics_output.parent.mkdir(parents=True, exist_ok=True)
    predictions_output.parent.mkdir(parents=True, exist_ok=True)
    metrics_output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    with predictions_output.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
