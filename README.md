<div align="center">
  <img src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" alt="Dafiti Logo" width="250">

  # Portal de Controle de Desligamentos e Ativos de T.I.
  
  **Um ecossistema seguro e inteligente para gestão de equipamentos e offboarding de colaboradores.**
</div>

---

## 💡 Sobre o Projeto

O **Controle de Desligamentos** nasceu da necessidade de modernizar, otimizar e assegurar a fidelidade no processo de offboarding da empresa. 
Ao lidar com alto volume de colaboradores e trocas de equipamentos, os controles manuais e e-mails paralelos geravam lacunas de comunicação e risco de extravio de ativos (Notebooks, Celulares, Monitores, etc).

Este projeto atua como **uma ponte blindada** entre a equipe da Recepção (que recolhe os equipamentos) e a equipe de T.I. e RH, sincronizando os dados em tempo real com uma base central (Google Sheets), garantindo que nada passe despercebido.

## 🎯 Motivação e Objetivos

Dentre as principais motivações que levaram ao desenvolvimento desta arquitetura, destacam-se:

- **Soberania de Dados:** Eliminar a chance de operadores excluírem / danificarem acidentalmente bases do RH. A interface visual da Recepção possui "travas" de segurança; ela pode atualizar Status de Equipamentos, mas é incapaz de alterar ou apagar e-mails corporativos.
- **Automação de E-mails:** Um poderoso Scanner em Apps Script que localiza envios dos robôs (planilhas autômatas), descompactando planilhas e registrando os desligados diretamente no banco central.
- **Monitoria Ativa:** Um Dashboard gerencial robusto e um "Cronjob" oculto que avisa a liderança imediata (por E-mail e Dash) sempre que uma devolução ultrapassar a barreira crítica dos dias pendentes.
- **UX/UI Aprimorado:** Tela de fácil aprendizagem, com cores focais para uso instintivo no dia a dia.

## 🏢 Governança do Projeto

- **Departamento Responsável:** Tecnologia da Informação (T.I.) & Infraestrutura
- **Líder e Arquiteto do Projeto:** Luiz Felipe Fernandes Sergio
- **Empresa:** Dafiti Group

## 🤖 Instruções para Codex

- O Codex deve usar sempre a skill `$caveman` durante esta conversa e manter respostas objetivas, curtas e técnicas.
- O Codex deve usar sempre `@Superpowers` antes de executar tarefas, respeitando as skills aplicáveis ao tipo de trabalho solicitado.
- O Codex não deve criar commits sem autorização explícita do responsável pelo projeto.

## 🛠️ Tecnologias e Arquitetura

Este sistema foi construído sobre uma base Full-Stack performática, contando com restrições Severas de Segurança como Rate Limiting (Anti-Brute Force), Bloqueios Middleware, Exponential Backoffs e Validações Zod para assegurar que nenhum tipo de injeção externa macule o banco do Google.

*   **Frontend:** React (Vite.js) + Tailwind CSS + Framer Motion
*   **Backend Node:** Node.js + Express (Integrações e Escudo Intermediário)
*   **Banco de Dados & Scripting:** Google Sheets + Google Apps Script (Advanced v3 Services)
*   **Segurança:** Schema Validation via Zod, Session Cookies.
*   **Deploy Cloud:** Vercel (Frontend Preview) e Render (Produção de Alta Disponibilidade)

---

### *Créditos Técnicos:*
*A estrutura arquitetônica, blindagens lógicas NodeJS, middlewares e conexões de rotas interligadas do ecossistema Google App Scripts deste projeto foram modeladas e concebidas utilizando Inteligência Artificial, por intermédio das instruções de código geradas via **Google AI Studio**.*
