#!/usr/bin/env bash
# Setup script for VigiClaim dataset
# 
# This script creates the required data directory structure and
# provides instructions for downloading the real Kaggle dataset.
#
# Usage:
#   ./scripts/setup-data.sh          # Create dirs + placeholder images
#   ./scripts/setup-data.sh --kaggle # Attempt Kaggle download (requires kagglehub CLI)
#
# Dataset: Car Damage Severity Dataset
# https://www.kaggle.com/datasets/prajwalbhamere/car-damage-severity-dataset

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data/raw/data3a"

echo "=== VigiClaim — Data Setup ==="
echo ""

# Create directory structure
mkdir -p "$DATA_DIR/validation/01-minor"
mkdir -p "$DATA_DIR/validation/02-moderate"
mkdir -p "$DATA_DIR/validation/03-severe"
mkdir -p "$DATA_DIR/training/01-minor"
mkdir -p "$DATA_DIR/training/02-moderate"
mkdir -p "$DATA_DIR/training/03-severe"

echo "✓ Directory structure created under $DATA_DIR"

# Check if --kaggle flag is passed
if [[ "${1:-}" == "--kaggle" ]]; then
  if command -v kaggle &>/dev/null; then
    echo "Downloading Car Damage Severity Dataset from Kaggle..."
    kaggle datasets download -d prajwalbhamere/car-damage-severity-dataset -p "$DATA_DIR/.." --unzip
    echo "✓ Dataset downloaded and extracted"
  else
    echo "✗ Kaggle CLI not found. Install it first:"
    echo "  pip install kagglehub"
    echo ""
    echo "Then run: ./scripts/setup-data.sh --kaggle"
    exit 1
  fi
else
  echo ""
  echo "Placeholder images are in place for development."
  echo "For real model predictions, download the dataset:"
  echo ""
  echo "  1. pip install kagglehub"
  echo "  2. ./scripts/setup-data.sh --kaggle"
  echo ""
  echo "Or manually from:"
  echo "  https://www.kaggle.com/datasets/prajwalbhamere/car-damage-severity-dataset"
fi
