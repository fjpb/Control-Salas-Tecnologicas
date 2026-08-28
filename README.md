# SGTSL

Sistema de Gestión de Salas Tecnológicas.

## Requisitos

- Docker
- Docker Compose

## Levantar

docker compose up --build -d

Aplicación

http://localhost:8083

Backend

http://localhost:8083/api/health

## Detener

docker compose down

## Reconstruir

docker compose down
docker compose up --build -d
