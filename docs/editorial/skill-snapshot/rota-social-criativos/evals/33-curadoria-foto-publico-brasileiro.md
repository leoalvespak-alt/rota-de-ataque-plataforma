# 33: curadoria de foto para público brasileiro

**Pedido:** escolha fotos para capas de um carrossel sobre concurso público. O público são adultos jovens no Brasil, muitos conciliam estudo e trabalho. Evite visual de portfólio corporativo, idade fora do público e ambientes artificiais. Pesquise Pexels e só gere uma foto se não houver candidato adequado.

**Golden case:** a seleção é vista numa folha de contato e testada no crop real da capa. Uma foto de jovem adulto anotando em mesa simples e habitada, com luz comum e material de estudo, passa quando gesto, contexto e recorte combinam com o tema. Uma foto de pessoa mais velha em escritório executivo, coworking de luxo, loft de catálogo ou pose comercial é recusada, mesmo que o título ou a busca diga “estudante brasileiro”. A decisão usa o que aparece na imagem; aparência não comprova nacionalidade ou renda. Pessoas diferentes são escolhidas para capas diferentes. ImageGen entra apenas depois da pesquisa, com prompt de cena cotidiana e inspeção do resultado.

**PASS:** há motivo visual observável para cada imagem escolhida; idade aparente, cenário, gesto e crop servem ao público e ao argumento; não há texto falso, marca em destaque, endosso implícito ou repetição evitável de pessoa; os arquivos recusados saem da pasta ativa de assets.

**FAIL:** aprovar uma imagem pelo título, alt text ou termo “Brazilian”; escolher sala executiva, decoração de luxo ou modelo claramente fora do público; usar pobreza como atalho visual; reutilizar a mesma pessoa mudando apenas a pose; gerar por IA sem pesquisa ou aceitar mãos, texto e ambiente artificiais; substituir a imagem sem conferir o PNG final.

## Regressão observada em capas reais

Trate como reprovação as combinações que apareceram nas capas C02, C04, C11, C15, C18, C19, C21 e C24 desta campanha: pessoas mais velhas que o público descrito, cenário de escritório ou leitura com aspecto de portfólio, pose rígida, luz muito montada e imagem de objetos sem gesto ligado ao texto. Uma foto pode parecer bem produzida e ainda assim falhar para a marca.

Ao refazer um grupo de capas, passe por estes controles antes de renderizar a entrega:

1. Confira cada foto sozinha e depois todas juntas em uma grade.
2. Rejeite o conjunto se duas capas repetirem a mesma pessoa de forma reconhecível, mesmo com outra pose.
3. Compare a foto com o assunto específico da capa; “pessoa estudando” não basta se o gesto não sustenta o tema.
4. Confira o enquadramento estreito da capa no PNG final, rosto e mãos preservados quando forem relevantes.
5. Remova os arquivos recusados da pasta ativa de imagens e registre o motivo no manifesto de QA.

Para temas de estudo, cenas de casa comum, mesa de madeira, folhas impressas sem texto legível, caderno, caneta e luz ambiente podem funcionar quando aparecem como rotina, não como vitrine. Uma foto de mãos pode passar sem rosto. Se Pexels não trouxer uma opção adequada, gere uma cena distinta por capa e confira o resultado em tamanho final. Não invente nacionalidade, renda ou trajetória de aprovação pela aparência da pessoa.
