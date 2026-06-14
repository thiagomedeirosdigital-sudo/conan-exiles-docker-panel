# 04 - Mods

O painel gerencia:

- lista de mods;
- ordem de carregamento;
- MODS= no .env;
- ConanSandbox/Mods/modlist.txt.

## Aplicação correta

Para aplicar mods corretamente, muitas vezes não basta reiniciar. É necessário recriar o container:

    docker compose up -d --force-recreate conan-exiles-enhanced

## Mods incompatíveis

O painel procura por erros como:

- failed check
- too old
- incompatible mods
- corrupted pak

Se aparecer "Mod is too old", remova o mod temporariamente até o autor atualizar.
