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

---

## Versão atual do painel

Esta versão inclui melhorias de segurança, organização visual e performance.

### Recursos atuais

- Painel protegido com Nginx + Basic Auth.
- Dashboard reorganizado com ações rápidas.
- Abas separadas: Dashboard, Mods e Atualizações, Backups, Automação, Diagnóstico e Configurações.
- Configurações com senhas protegidas: a API não retorna senha Admin nem senha RCON.
- Campos de senha em modo seguro: deixar vazio mantém a senha atual.
- Backups seguros antes de restart, updates e ações críticas.
- Gerenciamento de mods e ordem de carregamento.
- Verificação de updates de mods.
- Restart automático seguro com avisos RCON.
- Diagnóstico de rede, portas locais e Steam Query.
- Teste externo de portas via GitHub Actions.
- Modo Privacidade para esconder dados sensíveis em prints.
- Polling reduzido para melhorar performance.

### Cuidados antes de publicar prints

Antes de publicar imagens do painel, ative o Modo Privacidade para evitar exposição de IP público, nome real do servidor ou dados sensíveis.

## Segurança do RCON

A porta RCON do Conan Exiles usa TCP `25575`.

Por segurança, ela deve ficar presa em `127.0.0.1`, assim:

```yaml
- 127.0.0.1:25575:25575/tcp
```

Isso significa que o RCON não fica aberto publicamente na internet ou na rede externa.

O painel web continua conseguindo acessar o RCON internamente pela rede Docker usando:

```text
conan-exiles-enhanced:25575
```

Portanto, se a porta `25575` não aparecer aberta externamente, isso é esperado e correto.

Resumo:

```text
✅ RCON fechado para fora
✅ RCON acessível internamente pelo painel
✅ Painel pode enviar comunicados RCON
✅ Menor risco de acesso indevido à administração do servidor
```
