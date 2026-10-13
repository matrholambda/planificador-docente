# Publicar o Planificador no GitHub Pages

## Regra de ouro
No GitHub, carregue SOMENTE o conteúdo da pasta:

`01_PUBLICAR_NO_GITHUB`

NÃO carregue:
- `02_DADOS_PRIVADOS_NAO_PUBLICAR`
- backups privados
- listas de alunos
- ficheiros CSV de acompanhamento

## 1. Abrir o repositório
Abra o seu repositório `planificador-docente`.

## 2. Enviar os ficheiros
1. Entre no repositório.
2. Clique em **Add file → Upload files**.
3. Abra `01_PUBLICAR_NO_GITHUB` no Explorador do Windows.
4. Selecione TODOS os ficheiros dentro dessa pasta.
5. Arraste-os para o GitHub.
6. Confirme que `index.html` aparece na raiz do repositório.
7. Em **Commit changes**, escreva por exemplo:
   `Versão final do Planificador Docente`
8. Confirme o commit na branch `main`.

## 3. Ativar o GitHub Pages
1. Vá a **Settings**.
2. No menu lateral, abra **Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Branch: `main`.
5. Pasta: `/(root)`.
6. Clique em **Save**.
7. Aguarde alguns minutos.
8. O GitHub mostrará o endereço HTTPS do site.

## 4. Primeiro uso no PC
1. Abra o endereço do GitHub Pages.
2. Vá a **Definições**.
3. Clique em **Importar listas privadas**.
4. Selecione:
   `02_DADOS_PRIVADOS_NAO_PUBLICAR/dados_privados_turmas.json`
5. Vá a **Turmas** e confirme as listas.
6. Revise os nomes com `…`, porque estavam cortados nas capturas fornecidas.
7. Para 6.º, 7.º, 8.º e 9.º, use **Turmas → Colar lista** quando tiver as listas de alunos.

## 5. Instalar no iPhone
1. Abra o endereço do GitHub Pages no Safari.
2. Toque em **Partilhar**.
3. Escolha **Adicionar ao ecrã principal**.
4. Se aparecer, ative **Abrir como app**.
5. Abra a nova app.
6. Importe o backup mais recente OU o ficheiro de listas privadas.

## 6. PC e iPhone não sincronizam automaticamente
Esta versão é local-first por segurança.

Para passar dados:
1. No dispositivo onde trabalhou: **Definições → Exportar backup**.
2. Guarde o JSON no OneDrive.
3. No outro dispositivo: **Definições → Importar backup**.
4. Escolha o ficheiro do OneDrive.

Sugestão: faça um backup no fim de cada semana.

## 7. Atualizar a aplicação no futuro
1. Faça primeiro **Exportar backup**.
2. Substitua no GitHub apenas os ficheiros da pasta pública.
3. Faça um novo commit.
4. Mantenha o mesmo repositório e o mesmo GitHub Pages.
5. Abra novamente a app. Os dados locais devem permanecer.
6. Se houver comportamento estranho de cache, feche e volte a abrir a app ou limpe os dados do site apenas depois de ter backup.

## 8. Nunca guardar dados de alunos num GitHub público
O GitHub Pages serve apenas a aplicação e as planificações embebidas sem nomes.
TPC, participação, notas e listas devem ficar:
- no armazenamento local da app;
- em backups privados guardados no OneDrive.

Para sincronização automática entre dispositivos será necessária uma futura integração privada (por exemplo Microsoft Graph/OneDrive ou outra base autenticada).
