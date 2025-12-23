# MySQL Database Dockerfile
FROM mysql:8.0

# Copy initialization script
# Build context is project root, so path is relative to root
COPY ./docker/mysql/init.sql /docker-entrypoint-initdb.d/

# Use default MySQL configuration
# Custom configuration can be added here if needed

