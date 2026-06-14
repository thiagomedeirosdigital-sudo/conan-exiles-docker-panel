# 01 - Visão Geral

Este projeto gerencia um servidor Conan Exiles Enhanced em Linux usando Docker e um painel web em Next.js.

A ideia principal é evitar comandos perigosos diretos e padronizar operações seguras:

1. fazer backup antes de mudanças;
2. parar o Conan com timeout;
3. aplicar update ou mods;
4. recriar container quando necessário;
5. validar logs;
6. mostrar status visual no painel.

## Componentes

- conan-exiles-enhanced: container do servidor Conan.
- conan-web-panel: painel web.
- backup_conan_safe.sh: backup seguro.
- safe_restart_scheduler.py: reinício automático seguro.
- auto_update_checker.py: checagem e aplicação de updates de mods.
- APIs Next.js em painel-web/src/app/api.
- Componentes do painel em painel-web/src/app/components.

## Portas

- 7777/udp
- 7778/udp
- 27015/udp
- 25575/tcp
- 3000/tcp
