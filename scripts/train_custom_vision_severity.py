#!/usr/bin/env python3
"""Train an Azure Custom Vision classifier for car damage severity."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests
from azure.cognitiveservices.vision.customvision.training import CustomVisionTrainingClient
from azure.cognitiveservices.vision.customvision.training.models import ImageFileCreateBatch
from azure.cognitiveservices.vision.customvision.training.models import ImageFileCreateEntry
from msrest.authentication import ApiKeyCredentials


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload car damage severity images and train Custom Vision."
    )
    parser.add_argument(
        "--dataset-root",
        default="data/raw/data3a/training",
        help="Folder containing one subfolder per label.",
    )
    parser.add_argument(
        "--project-name",
        default=os.getenv("CUSTOM_VISION_PROJECT_NAME", "car-damage-severity"),
        help="Custom Vision project name.",
    )
    parser.add_argument(
        "--domain-name",
        default=os.getenv("CUSTOM_VISION_DOMAIN_NAME", "General"),
        help="Custom Vision classification domain name.",
    )
    parser.add_argument(
        "--classification-type",
        default=os.getenv("CUSTOM_VISION_CLASSIFICATION_TYPE", "Multilabel"),
        choices=["Multiclass", "Multilabel"],
        help="Custom Vision classification type.",
    )
    parser.add_argument(
        "--reuse-project-id",
        default=os.getenv("CUSTOM_VISION_PROJECT_ID"),
        help="Existing project id to reuse instead of creating a new project.",
    )
    parser.add_argument(
        "--publish-name",
        default=os.getenv("CUSTOM_VISION_PUBLISH_NAME"),
        help="Optional prediction model publish name.",
    )
    parser.add_argument(
        "--prediction-resource-id",
        default=os.getenv("CUSTOM_VISION_PREDICTION_RESOURCE_ID"),
        help="Optional Azure prediction resource id used when publishing.",
    )
    parser.add_argument(
        "--max-images-per-class",
        type=int,
        default=int(os.getenv("CUSTOM_VISION_MAX_IMAGES_PER_CLASS", "0")),
        help="Optional cap per class for a faster demo run. 0 uploads all images.",
    )
    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="Train the project without uploading local images first.",
    )
    parser.add_argument(
        "--export-docker",
        action="store_true",
        help="Request and download a DockerFile export for the trained iteration.",
    )
    parser.add_argument(
        "--docker-flavor",
        default=os.getenv("CUSTOM_VISION_DOCKER_FLAVOR", "Linux"),
        choices=["Linux", "Windows", "ARM"],
        help="Docker export flavor.",
    )
    parser.add_argument(
        "--export-output",
        default=os.getenv("CUSTOM_VISION_EXPORT_OUTPUT", "reports/custom-vision-docker-export.zip"),
        help="Path where the Docker export zip should be saved.",
    )
    return parser.parse_args()


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def label_from_folder(folder: Path) -> str:
    return folder.name.split("-", 1)[-1].strip().lower()


def collect_images(dataset_root: Path, max_per_class: int) -> dict[str, list[Path]]:
    if not dataset_root.exists():
        raise SystemExit(f"Dataset root does not exist: {dataset_root}")

    images_by_label: dict[str, list[Path]] = {}
    for class_dir in sorted(path for path in dataset_root.iterdir() if path.is_dir()):
        label = label_from_folder(class_dir)
        images = sorted(
            path
            for path in class_dir.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        )
        if max_per_class > 0:
            images = images[:max_per_class]
        if images:
            images_by_label[label] = images

    if not images_by_label:
        raise SystemExit(f"No images found under {dataset_root}")
    return images_by_label


def get_or_create_project(
    trainer: CustomVisionTrainingClient,
    project_name: str,
    domain_name: str,
    classification_type: str,
    reuse_project_id: str | None,
):
    if reuse_project_id:
        print(f"Reusing Custom Vision project: {reuse_project_id}")
        return trainer.get_project(reuse_project_id)

    domains = trainer.get_domains()
    domain = next(
        (
            item
            for item in domains
            if item.type == "Classification" and item.name.lower() == domain_name.lower()
        ),
        None,
    )
    if domain is None:
        available = ", ".join(
            sorted(item.name for item in domains if item.type == "Classification")
        )
        raise SystemExit(f"Classification domain '{domain_name}' not found. Available: {available}")

    print(
        f"Creating Custom Vision project '{project_name}' "
        f"with domain '{domain.name}' and classification type '{classification_type}'"
    )
    return trainer.create_project(
        project_name,
        domain_id=domain.id,
        classification_type=classification_type,
    )


def get_or_create_tags(
    trainer: CustomVisionTrainingClient, project_id: str, labels: list[str]
) -> dict[str, str]:
    existing = {tag.name: tag.id for tag in trainer.get_tags(project_id)}
    tags: dict[str, str] = {}
    for label in labels:
        if label in existing:
            tags[label] = existing[label]
        else:
            created = trainer.create_tag(project_id, label)
            tags[label] = created.id
    return tags


def upload_images(
    trainer: CustomVisionTrainingClient,
    project_id: str,
    images_by_label: dict[str, list[Path]],
    tags_by_label: dict[str, str],
) -> None:
    entries: list[ImageFileCreateEntry] = []
    for label, paths in images_by_label.items():
        for path in paths:
            entries.append(
                ImageFileCreateEntry(
                    name=f"{label}/{path.name}",
                    contents=path.read_bytes(),
                    tag_ids=[tags_by_label[label]],
                )
            )

    total = len(entries)
    print(f"Uploading {total} images to Custom Vision")
    failed = 0
    for index in range(0, total, 64):
        batch_entries = entries[index : index + 64]
        result = trainer.create_images_from_files(
            project_id, ImageFileCreateBatch(images=batch_entries)
        )
        batch_failed = [
            image for image in result.images if not image.status.startswith("OK")
        ]
        failed += len(batch_failed)
        print(f"Uploaded {min(index + 64, total)}/{total}; batch failures: {len(batch_failed)}")
        if batch_failed:
            for image in batch_failed[:5]:
                print(f"  - {image.source_url or image.image.id}: {image.status}")

    if failed:
        raise SystemExit(f"Upload completed with {failed} failed images")


def train_and_wait(trainer: CustomVisionTrainingClient, project_id: str):
    print("Starting training")
    iteration = trainer.train_project(project_id)
    while iteration.status not in {"Completed", "Failed"}:
        print(f"Training status: {iteration.status}")
        time.sleep(10)
        iteration = trainer.get_iteration(project_id, iteration.id)

    if iteration.status == "Failed":
        raise SystemExit("Custom Vision training failed")

    print(f"Training completed: iteration={iteration.id}, name={iteration.name}")
    return iteration


def export_docker(
    trainer: CustomVisionTrainingClient,
    project_id: str,
    iteration_id: str,
    flavor: str,
    output_path: Path,
) -> None:
    print(f"Requesting DockerFile export with flavor '{flavor}'")
    exports = trainer.get_exports(project_id, iteration_id)
    export = next(
        (
            item
            for item in exports
            if item.platform == "DockerFile" and item.flavor == flavor
        ),
        None,
    )
    if export is None:
        trainer.export_iteration(project_id, iteration_id, "DockerFile", flavor=flavor)

    export = None
    while export is None or export.status not in {"Done", "Failed"}:
        time.sleep(10)
        exports = trainer.get_exports(project_id, iteration_id)
        export = next(
            (
                item
                for item in exports
                if item.platform == "DockerFile" and item.flavor == flavor
            ),
            None,
        )
        status = export.status if export else "NotStarted"
        print(f"Export status: {status}")

    if export.status == "Failed":
        raise SystemExit("Docker export failed")
    if not export.download_uri:
        raise SystemExit("Docker export completed without a download URI")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(export.download_uri, timeout=120)
    response.raise_for_status()
    output_path.write_bytes(response.content)
    print(f"Docker export downloaded to {output_path}")


def main() -> int:
    args = parse_args()
    endpoint = get_required_env("CUSTOMVISION_TRAINING_ENDPOINT")
    training_key = get_required_env("CUSTOMVISION_TRAINING_KEY")

    dataset_root = Path(args.dataset_root)
    images_by_label = collect_images(dataset_root, args.max_images_per_class)
    print("Dataset summary:")
    for label, images in images_by_label.items():
        print(f"  {label}: {len(images)} images")

    credentials = ApiKeyCredentials(in_headers={"Training-key": training_key})
    trainer = CustomVisionTrainingClient(endpoint, credentials)

    project = get_or_create_project(
        trainer,
        project_name=args.project_name,
        domain_name=args.domain_name,
        classification_type=args.classification_type,
        reuse_project_id=args.reuse_project_id,
    )
    tags_by_label = get_or_create_tags(trainer, project.id, sorted(images_by_label))
    if args.skip_upload:
        print("Skipping image upload")
    else:
        upload_images(trainer, project.id, images_by_label, tags_by_label)
    iteration = train_and_wait(trainer, project.id)

    if args.publish_name and args.prediction_resource_id:
        trainer.publish_iteration(
            project.id,
            iteration.id,
            args.publish_name,
            args.prediction_resource_id,
        )
        print(f"Published iteration as '{args.publish_name}'")

    if args.export_docker:
        export_docker(
            trainer,
            project.id,
            iteration.id,
            args.docker_flavor,
            Path(args.export_output),
        )

    print(f"Project id: {project.id}")
    print(f"Iteration id: {iteration.id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
