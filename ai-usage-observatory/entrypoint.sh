#!/bin/sh
# Fix ownership of data directory so the non-root user can write to bind mounts.
# This runs as root, then drops privileges to the observatory user.
mkdir -p /data/artifacts
chown -R observatory:observatory /data
exec su-exec observatory node /app/entrypoint.mjs
