# Google Apps Script

## Arquivos

Este projeto usa Apps Scripts separados por planilha.

Para a planilha de Desligados, copie todo o conteúdo de `apps-script/Desligados-prod.gs` para o arquivo `Code.gs` do projeto Apps Script configurado em `GOOGLE_SCRIPT_URL`.

Para a planilha de Motoboy, copie todo o conteúdo de `apps-script/Controle-Motoboy-homologacao.gs` para o arquivo `Code.gs` do projeto Apps Script configurado em `MOTOBOY_GOOGLE_SCRIPT_URL`.

Exemplo:

`https://script.google.com/macros/s/<deployment-id>/exec`

O arquivo legado misto foi removido. Publique somente um dos dois arquivos acima em cada projeto Apps Script.

## Propriedades Obrigatórias

No projeto Apps Script de Desligados, abra `Configurações do projeto` > `Propriedades do script` e crie:

```text
DESLIGADOS_SPREADSHEET_ID=<id-da-planilha-de-desligados>
REMETENTE_PLANILHA=<email-remetente-das-importacoes>
ALERTA_BARRA_FUNDA_TO=<email-principal>
ALERTA_BARRA_FUNDA_CC=<emails-em-copia-separados-por-virgula>
ALERTA_BELO_HORIZONTE_TO=<email-principal>
ALERTA_BELO_HORIZONTE_CC=<emails-em-copia-separados-por-virgula>
ALERTA_EXTREMA_TO=<email-principal>
ALERTA_EXTREMA_CC=<emails-em-copia-separados-por-virgula>
```

As propriedades terminadas em `_TO`, o ID e o remetente são obrigatórios. As propriedades `_CC` podem ficar vazias.

No projeto Apps Script de Motoboy, abra `Configurações do projeto` > `Propriedades do script` e crie:

```text
MOTOBOY_SPREADSHEET_ID=<id-da-planilha-de-motoboy>
```

Nos dois projetos Apps Script, crie também uma propriedade com o mesmo segredo
aleatório configurado em `APPS_SCRIPT_SHARED_SECRET` no backend:

```text
BACKEND_SHARED_SECRET=<segredo-aleatorio-com-no-minimo-32-caracteres>
```

Gere um segredo exclusivo para esta integração (por exemplo, com
`openssl rand -hex 32`). Não reutilize `SESSION_SECRET` e não registre o valor
no repositório.

Opcional para Motoboy, se o nome da aba for diferente do padrão:

```text
MOTOBOY_SHEET_NAME=Motoboy
```

O ID da planilha é o trecho entre `/d/` e `/edit` na URL do Google Sheets.

## Deploy

Depois de colar o código correto de cada Apps Script e configurar as propriedades necessárias:

1. Clique em `Implantar` > `Gerenciar implantações`.
2. Edite a implantação atual.
3. Em `Versão`, selecione `Nova versão`.
4. Se a conta permitir, restrinja o acesso nativo ao domínio/usuários necessários.
   Quando a implantação precisar permanecer como `Qualquer pessoa` para aceitar
   chamadas do backend, a autenticação HMAC deste projeto é obrigatória e o Web
   App rejeitará chamadas sem assinatura válida.
5. Clique em `Implantar`.

## Teste

Chamadas diretas pelo navegador agora devem retornar `Unauthorized`. Para validar
a URL real com uma requisição assinada, configure `.env` e execute:

```bash
node scripts/validate-live-desligados-dashboard.mjs
```

Se a validação acusar meses no formato `08/2026` ou `equipamentosMensal` igual a `mensalData`, a implantação de Desligados ainda está com código legado.
