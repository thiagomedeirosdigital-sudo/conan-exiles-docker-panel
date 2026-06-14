# 02 - Instalação do Zero

## Requisitos

- Linux
- Docker
- Docker Compose
- Git

## Passos gerais

Clone o repositório:

    git clone https://github.com/SEU_USUARIO/conan-exiles-docker-panel.git
    cd conan-exiles-docker-panel

Copie os exemplos:

    cp examples/.env.example .env
    cp examples/docker-compose.example.yml docker-compose.yml

Edite o .env com:

- nome do servidor;
- senha admin;
- senha RCON;
- lista de mods;
- UPDATE_ON_START=true.

Suba os containers:

    docker compose up -d --build

Acesse:

    http://IP_DO_SERVIDOR:3000
