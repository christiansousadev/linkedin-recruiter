# 🚀 LinkedIn Recruiter Pipeline & Data Extractor

Um ecossistema completo para automação de recrutamento, prospecção e extração de talentos. O sistema varre URLs de busca do LinkedIn, extrai os perfis nativos em PDF via automação headless, realiza o parse estruturado dos dados e consolida as informações em formatos analíticos (JSON e Excel), mantendo trilhas de auditoria em tempo real.

## 🏗️ Arquitetura e Ecossistema

O projeto foi desenhado sob uma arquitetura modular cliente-servidor, focada em resiliência de extração e governança de dados:

* **Frontend (Dashboard):** Desenvolvido em **React / Next.js (App Router)** com **Tailwind CSS**. Interface responsiva que consome streams de dados em tempo real (Server-Sent Events via chunks) para exibir o progresso da extração e painel de auditoria de logs.
* **Backend (Motor de Extração):** Construído em **Node.js / Express**. Utiliza **Playwright** acoplado ao `puppeteer-extra-plugin-stealth` para navegação anônima e evasão de bloqueios anti-bot. O parse de PDFs é feito em memória utilizando `pdfjs-dist`.
* **Extensão do Chrome:** Uma ferramenta auxiliar enxuta para capturar a sessão segura (`li_at`) do usuário autenticado no LinkedIn, enviando o token para o motor sem expor credenciais primárias.
* **Governança e Rastreabilidade:** Implementação de logs estruturados em JSONL (Audit Logs) que registram cada etapa do fluxo (sucessos, bloqueios, falhas do DOM e uso da rede).

---

## ⚙️ Como o Sistema Funciona

1. O recrutador realiza uma busca avançada no LinkedIn e copia a URL resultante.
2. Através da extensão auxiliar, o token de sessão ativo (`li_at`) é copiado com um clique.
3. No Dashboard, o usuário insere a URL, o token e define a profundidade da varredura (número de páginas).
4. O Backend assume: injeta os cookies no navegador fantasma, mapeia todos os candidatos da paginação e inicia o download sequencial dos currículos em PDF.
5. Um algoritmo de *parsing* analisa dinamicamente o texto estruturado de cada currículo, extraindo blocos-chave (Nome, Skills, Experiência, Educação, etc.) mesmo em perfis com seções ausentes.
6. O resultado é disponibilizado instantaneamente no frontend para download em `.xlsx` ou `.json`.

---

## 🛠️ Pré-requisitos

Para rodar o projeto localmente, a máquina necessita apenas de:
* **Node.js (Versão LTS):** [Download Oficial](https://nodejs.org/)
* **Google Chrome:** Instalado no caminho padrão do sistema operativo.

---

## 🔌 Passo 1: Instalação da Extensão (Capturador de Sessão)

Para que a automação acesse a busca do LinkedIn autenticada, instale a extensão auxiliar desenvolvida no pacote do projeto:

1. Abra o Google Chrome e digite na barra de endereços: `chrome://extensions/`.
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"**.
3. Clique no botão **"Carregar sem compactação"** no menu superior.
4. Navegue até a pasta onde o projeto foi clonado e selecione a subpasta da extensão.
5. Para facilitar o uso diário, clique no ícone de quebra-cabeça do Chrome e **fixe (pin)** o "Autenticador Pipeline" na sua barra de tarefas.
6. Sempre que precisar, basta clicar no ícone da extensão e depois no botão **"Copiar Token (li_at)"**. O token da sua sessão ativa do LinkedIn irá direto para a área de transferência.

*Nota de Segurança: A extensão possui permissões estritas (`activeTab`, `cookies`) limitadas exclusivamente ao domínio `linkedin.com` para realizar a leitura do cookie `li_at` localmente.*

---

## 🚀 Passo 2: Executando o Projeto

O projeto foi desenhado para ser "Plug & Play". Siga os passos abaixo para configurar o ambiente e iniciar a extração:

1. Configuração de Variáveis de Ambiente (Frontend)
Para garantir a comunicação entre a interface e o motor de extração, configure o endpoint da API:
Navegue até a pasta frontend/.
Localize o arquivo .env.example, faça uma cópia e renomeie-a para .env.local.
O arquivo já vem pré-configurado com a rota padrão: NEXT_PUBLIC_API_URL=http://127.0.0.1:3001.
2. Inicialização Automatizada
Na raiz do projeto, localize e execute o arquivo iniciar.bat. Este script automatiza todo o processo de infraestrutura:
Verificação de Dependências: O script checa se o Node.js está presente no sistema.
Instalação Autônoma: Caso seja a primeira execução, o script detectará a ausência das pastas node_modules e executará o npm install tanto no Frontend quanto no Backend.
Playwright Setup: O motor baixará automaticamente os binários do Chromium necessários para as navegações stealth.
3. Execução dos Serviços
Após o setup inicial, o terminal gerenciará o ciclo de vida dos processos:
Backend: Iniciado na porta 3001.
Frontend: Iniciado na porta 3000.
Abertura Automática: O script aguarda 5 segundos para a estabilização dos serviços e abre automaticamente o Dashboard no seu Google Chrome.

---

## 🛡️ Governança e Boas Práticas Adotadas

* **Prevenção de Timeout:** Uso de estratégias robustas com localizadores explícitos no Playwright (ex: focar no escopo `<main>`) para mitigar variações no DOM (Creator Mode x Perfil Normal).
* **Tratamento de Erros:** O parser aplica *fallbacks* lógicos em cascata usando âncoras flexíveis, impedindo que campos quebrem a execução caso um usuário não possua determinada seção no currículo (ex: ausência de Resumo).
* **Auditoria Contínua:** Painel de Governança integrado ao frontend, permitindo monitorar cada etapa do robô, com suporte a filtros de *Severity* (INFO, WARN, ERROR) em tempo real, baseados em arquivos de log limpos e desacoplados do motor principal.
* **Isolamento de Credenciais:** O sistema não salva senhas nem o token persistente em banco de dados; a injeção da sessão ocorre estritamente em memória (Puppeteer Context) por requisição.