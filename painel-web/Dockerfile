# Estágio de construção e execução leve
FROM node:18-alpine

WORKDIR /app

# Instala dependências globais se necessário
RUN apk add --no-cache libc6-compat docker-cli docker-cli-compose bash coreutils findutils grep

# Criamos a estrutura básica do Next.js
COPY package*.json ./
RUN npm install

# Copia o resto do código do painel
COPY . .

# Expõe a porta do painel
EXPOSE 3000

# Comando para rodar em modo de produção (super leve)
CMD ["npm", "run", "dev"]
