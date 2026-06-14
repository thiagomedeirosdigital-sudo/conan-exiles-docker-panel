# 03 - Backups, Restart Seguro e Auto Update

## Backup seguro

O backup seguro protege:

- game_0.db
- game_0.db-wal
- game_0.db-shm
- .env
- docker-compose.yml
- configs do Conan
- modlist.txt

Antes de restart, update ou aplicação de mods, o painel deve criar um backup.

## Restart seguro

O comando STOP direto foi bloqueado no painel para evitar desligamento sem backup.

Fluxo seguro:

1. aviso aos jogadores via RCON;
2. backup pré-restart;
3. parada com timeout;
4. início do container;
5. validação de logs.

## Auto update

O auto update verifica mods periodicamente.

Fluxo:

1. checa mods;
2. detecta mudança;
3. envia aviso RCON;
4. aguarda;
5. faz backup;
6. reinicia ou recria container;
7. valida logs.

Com UPDATE_ON_START=true, o servidor atualiza ao iniciar ou recriar o container.
