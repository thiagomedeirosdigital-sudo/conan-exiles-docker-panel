# 06 - Problemas e Correções

## Container online, mas jogo offline

O Docker pode estar Up, mas o Conan ainda estar:

- atualizando;
- validando arquivos;
- baixando mods;
- travado em mod incompatível.

Verifique logs:

    docker logs --tail 300 conan-exiles-enhanced

## Mod incompatível

Erro comum:

    Mod is too old (out of date)
    You are running incompatible mods

Correção:

1. remover mod do .env;
2. remover mod do modlist.txt;
3. limpar cache de mods;
4. recriar container.

## Conflito de container

Erro:

    container name is already in use

Correção:

    docker rm -f conan-exiles-enhanced
    docker compose up -d --force-recreate conan-exiles-enhanced

## Permission denied em backups

Correção:

    sudo chown -R linux:linux /home/linux/conan-server/backups_safe
