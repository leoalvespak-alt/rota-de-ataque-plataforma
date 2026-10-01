# Processo de mudança segura da skill

Use este processo quando alterar regras, referências ou exemplos da skill. A skill atual é o baseline estável; cada mudança deve responder a um problema observado e manter o escopo pequeno.

1. **Registre o motivo.** Descreva o defeito observado, o pedido que o revelou e o comportamento esperado. Não reescreva regras adjacentes sem evidência de que também falham.
   Ao acrescentar um estilo novo, mantenha a gramática já aprovada como baseline. Registre qual referência motivou a adição e descreva o uso como opção, com limites para leitura, marca e prova.
2. **Escolha a cobertura antes da regra.** Crie ou atualize um cenário em `evals/` que reproduza o caso. Para um comportamento central, inclua um golden case com entrada e resultado de referência, além dos critérios de falha.
3. **Faça a menor alteração suficiente.** Edite apenas as instruções ou referências necessárias para que a skill passe o cenário sem regredir regras anteriores.
4. **Revise a regressão.** Passe os novos critérios e os cenários existentes relacionados. Se uma regra precisa mudar e um caso anterior deixa de valer, registre a razão e atualize o caso deliberadamente.
   Cobertura visual mínima para estas regras: conferir um post, a capa e os cards de um carrossel, todos os Stories, o escopo de um tema geral com prova de um plano identificado, a exceção de um comparativo solicitado e a identidade das pessoas entre capas. Pesquisar o texto final por `—`.
5. **Confira fidelidade e escopo.** Verifique links locais, nomes de arquivos, fontes das afirmações e o diff completo. Confirme que exemplos de teste não viraram templates de produção e que nenhum material de terceiros perdeu atribuição ou licença.
6. **Prepare o push em clone isolado.** Comece de `main` atualizado, copie somente os arquivos alterados da skill, confira `git diff --check` e a lista de arquivos staged. Preserve qualquer alteração alheia.
7. **Publique sem reescrever histórico.** Faça commit apenas depois da revisão do diff. Use push fast-forward; se a branch remota avançou, sincronize e revise de novo. Confirme o SHA remoto e que o clone ficou limpo.

Nenhum cenário recebe status de aprovado sem leitura contra os critérios escritos. Registre a mudança com motivo, arquivos tocados, cenários consultados e SHA do commit.
