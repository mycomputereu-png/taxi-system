#!/bin/bash
set -e

# Login to Docker Hub (or other registry)
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Pull the latest images
docker-compose pull

# Stop and remove old containers, then start new ones
docker-compose down
docker-compose up -d

# Clean up old images
docker image prune -f
