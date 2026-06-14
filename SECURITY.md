# Segurança

Este projeto controla operações sensíveis de um servidor Conan Exiles.

Nunca publique:

- .env real
- senha admin
- senha RCON
- banco game_0.db
- backups reais
- logs com Steam IDs
- tokens ou chaves privadas

## RCON

Use senha forte, firewall e evite expor RCON publicamente.

## Docker socket

O painel pode acessar o Docker para parar e recriar containers. Use em ambiente confiável.
