# 05 - Status de Rede e Portas

O painel possui /api/network e card visual no Dashboard.

Ele verifica:

- IP público;
- Docker online;
- portas locais mapeadas;
- Steam Query local;
- status local geral.

## Portas

- 7777 UDP
- 7778 UDP
- 27015 UDP
- 25575 TCP

## Limite do teste local

O teste local não confirma se a operadora liberou entrada externa. Para isso:

1. compare o IP público do painel com o IP WAN do roteador;
2. teste pelo 4G/5G;
3. rode o workflow externo no GitHub Actions.

## CGNAT

Se o IP WAN do roteador começar com:

- 100.64.x.x
- 10.x.x.x
- 172.16.x.x até 172.31.x.x
- 192.168.x.x

há forte indício de CGNAT.
