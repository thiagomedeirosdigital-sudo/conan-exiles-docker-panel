# Conan Exiles Docker Panel

Painel web para gerenciamento de servidor **Conan Exiles Enhanced Dedicated Server** em **Linux + Docker**.

Este projeto nasceu de uma instalação real de servidor Conan em Linux, com foco em operação segura, backups, mods, atualização automática e diagnóstico de rede.

## Recursos principais

- Dashboard do servidor
- Controle seguro de reinício
- Backups seguros antes de restart, update e mods
- Gerenciamento de mods e ordem de carregamento
- Detecção de mods incompatíveis
- Auto update de mods com aviso no chat via RCON
- RCON direto pelo painel
- Diagnóstico de portas locais
- Steam Query local
- Card de status de rede
- Workflow GitHub Actions para teste externo de portas
- Documentação para reinstalação do zero

## Portas usadas

| Porta | Protocolo | Uso |
|---|---|---|
| 3000 | TCP | Painel web |
| 7777 | UDP | Jogo Conan |
| 7778 | UDP | Jogo Conan |
| 27015 | UDP | Steam Query / listagem |
| 25575 | TCP | RCON |

> Atenção: não exponha RCON publicamente sem firewall, senha forte e controle de acesso.

## Estrutura

docs/ - Documentação completa  
examples/ - Arquivos de exemplo sanitizados  
scripts/ - Scripts de backup, restart e update  
painel-web/ - Código do painel Next.js  
.github/workflows/ - Testes externos via GitHub Actions  

## Teste externo de portas

O workflow **External Conan Port Test** testa o servidor de fora da rede local usando GitHub Actions.

Interpretação recomendada:

- **Steam Query UDP respondeu:** o servidor está visível externamente.
- **TCP/RCON falhou, mas Steam Query respondeu:** normalmente não é problema para jogadores. RCON fechado externamente pode ser mais seguro.
- **Steam Query UDP falhou:** investigue roteador, firewall, redirecionamento UDP, CGNAT, operadora ou IP público.

## Segurança

Nunca publique:

- .env real
- senhas de admin/RCON
- game_0.db
- backups reais
- logs com Steam IDs
- arquivos de mods baixados
- tokens ou chaves privadas

Use os arquivos em examples/ como base.
