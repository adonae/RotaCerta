# RotaCerta

Sistema de entregas para loja e motoboy, com rota otimizada, link individual para cada cliente e mapa ao vivo durante a entrega.

## Como funciona

1. A loja entra no painel com senha e cria a rota do dia.
2. Cadastra os pedidos (nome, telefone, CEP, endereço e referência).
3. O sistema busca os endereços no mapa e calcula a melhor ordem de entrega partindo do ponto de retirada.
4. A loja envia **um link para o motoboy** e **um link para cada cliente**.
5. O motoboy vê as paradas numeradas e usa os botões **Em rota** e **Entregue**.
6. Ao tocar em **Entregue**, ele precisa tirar uma foto do local da entrega. A loja pode ver a foto no painel; ela é apagada automaticamente após **3 dias**.
7. Quando o motoboy toca em **Em rota**, o cliente vê o mapa ao vivo. Em **Entregue**, o cliente vê a confirmação com o horário.

Não há controle financeiro nem valores de pedido.

## Estrutura

```
public/                 interface publicada
  index.html            página inicial
  painel.html           painel da loja (senha)
  rota.html             rota do motoboy (link com token)
  acompanhar.html       acompanhamento do cliente (link com token)
  assets/app.css        design system
  assets/common.js      utilitários compartilhados
  assets/painel.js
  assets/rota.js
  assets/acompanhar.js
  solo/                 versão 1 (somente localStorage, preservada)
src/
  worker.js             API do Cloudflare Worker
  lib.js                banco, tokens, senha, geografia e OSRM
migrations/
  0001_init.sql         schema do banco D1
  0002_order_cep.sql    coluna de CEP nos pedidos
  0003_delivery_photo.sql  referência da foto de entrega
wrangler.jsonc          configuração do Worker + D1 + KV + assets
```

## Rodar localmente

Requisitos: Node.js 20+.

```bash
npm install
npx wrangler d1 migrations apply DB --local
npm run dev
```

Abra `http://localhost:8787/painel`.

A senha local inicial está em `.dev.vars` (`ADMIN_PASSWORD=rotacerta`). Na primeira entrada, ela é convertida em hash e salva no D1 local. Enquanto a senha não for alterada dentro do painel, aparece um aviso de **senha inicial em uso**. Altere em **Configurações**.

### Testes automatizados (opcional)

Com o servidor local rodando em outro terminal:

```bash
npm run test:e2e
```

O teste usa o Chrome instalado na máquina (defina `CHROME_PATH` se necessário), percorre painel, rota e acompanhamento do cliente, e salva as capturas de tela na pasta temporária do sistema (`SHOTS_DIR` para escolher outra pasta). Ele cria e exclui a própria rota de teste.

Se precisar zerar o banco local:

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .wrangler\state\v3\d1
npx wrangler d1 migrations apply DB --local
```

Também é possível usar o atalho `start.bat` no Windows.

## Publicar na Cloudflare (grátis)

1. Crie uma conta em <https://dash.cloudflare.com>.
2. No terminal:

```bash
npx wrangler login
```

3. Crie o banco D1:

```bash
npx wrangler d1 create rotacerta
```

4. Copie o `database_id` retornado e substitua o valor de exemplo em `wrangler.jsonc`.
5. Crie o namespace KV das fotos de entrega:

```bash
npx wrangler kv namespace create PHOTOS
```

Copie o `id` retornado para o bloco `kv_namespaces` de `wrangler.jsonc`.

6. Aplique o schema no banco remoto:

```bash
npx wrangler d1 migrations apply DB --remote
```

7. Defina a senha inicial do painel como segredo:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

8. Publique:

```bash
npm run deploy
```

9. Acesse `https://rotacerta.SEU-SUBDOMINIO.workers.dev/painel`, entre com a senha definida e troque-a em **Configurações**.

> O endereço `workers.dev` é fixo e HTTPS. Para usar domínio próprio, configure uma rota/custom domain no painel da Cloudflare.

### Depois de publicar

- Painel: `/painel`
- Rota do motoboy: `/rota?t=TOKEN` (gerado no painel)
- Acompanhamento do cliente: `/acompanhar?t=TOKEN` (gerado no painel)
- Os links são montados automaticamente com o endereço do site.

## Mapas e endereços

- **Nominatim/OpenStreetMap** geocodifica os endereços no navegador da loja, com intervalo entre requisições para respeitar o uso gratuito.
- Se o endereço completo não existir no mapa (rua com nome diferente, por exemplo), o sistema tenta o **CEP** no Nominatim e, se ainda falhar, usa a **AwesomeAPI CEP**. O pedido fica marcado como **Aproximada (CEP)** para conferência do pino.
- **ViaCEP** (com fallback para **BrasilAPI**) preenche rua, bairro e cidade a partir do CEP digitado no pedido. Basta informar o número para completar o endereço.
- **OSRM** calcula a ordem por ruas no Worker. Se o serviço falhar, o sistema usa uma estimativa por distância e avisa no painel.
- Alguns números de casa não existem no OpenStreetMap. Nesse caso, use **Ajustar no mapa** no pedido para posicionar o pino manualmente.
- A rota sempre começa no endereço de retirada configurado (padrão: Avenida Tabajaras, 848, João Pessoa/PB).

## Fotos das entregas

- Ao concluir uma entrega, o motoboy precisa bater uma foto do local. A foto é comprimida no celular antes do envio (máximo ~1440 px, JPEG).
- A loja vê a foto pelo ícone de câmera na parada entregue do painel.
- As imagens ficam no **Cloudflare KV** (`PHOTOS`) e expiram automaticamente em **3 dias** (`expirationTtl`). O banco D1 guarda apenas a referência da foto.
- Desfazer uma entrega apaga a foto correspondente. Excluir o pedido ou a rota também remove as fotos.
- O link do cliente não mostra a foto; ela é visível apenas no painel da loja.

## Regras do sistema

- Cada rota tem um token aleatório para o motoboy e cada pedido tem um token aleatório para o cliente.
- O painel usa senha com hash PBKDF2 e sessões de 30 dias.
- O servidor permite **uma entrega “Em rota” por vez**; a segunda tentativa retorna erro e a interface orienta a finalizar a atual.
- O mapa do cliente só recebe a posição do entregador enquanto o pedido dele está em rota.
- O formulário de novo pedido **não fecha ao clicar fora** e guarda um rascunho no navegador até o pedido ser adicionado ou o botão **Cancelar** ser usado.
- A posição do motoboy é enviada a cada ~8 segundos enquanto houver entrega ativa e a página estiver aberta.
- A conclusão da entrega exige foto e o servidor recusa a requisição sem ela.
- As fotos de entrega expiram em 3 dias no KV; referências antigas deixam de aparecer no painel.
- O sistema usa *polling*: o cliente atualiza a cada 4 segundos em rota; o painel, a cada 10 segundos.

## Segurança e privacidade

- Nunca compartilhe o link do motoboy com clientes: ele mostra todas as paradas.
- O link do cliente mostra apenas o próprio pedido, o nome do entregador e a posição durante a entrega.
- Troque a senha inicial antes de usar em produção.
- Para recuperar o acesso caso esqueça a senha:
  - redefina `ADMIN_PASSWORD` com `npx wrangler secret put ADMIN_PASSWORD`; e
  - apague o hash salvo no banco:
    ```bash
    npx wrangler d1 execute DB --remote --command "UPDATE settings SET value='' WHERE key='password_hash'; UPDATE settings SET value='1' WHERE key='password_is_default';"
    ```
  - no próximo login, a senha do segredo será aplicada novamente.

## Limites do plano gratuito

Cloudflare Workers Free e D1 Free são suficientes para uma loja com dezenas de pedidos por dia. Os limites de CPU e de requisições gratuitas podem ser consultados em <https://developers.cloudflare.com/workers/platform/limits/>.

## Versão 1

A versão anterior, que funciona só com `localStorage` (sem servidor), continua disponível em `/solo/`.
