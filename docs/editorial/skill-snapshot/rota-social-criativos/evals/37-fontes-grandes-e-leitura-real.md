# 37: fonte nominal e conforto de leitura

**Caso observado:** em C03 a C30, a versão anterior passava no piso técnico de 20 px, mas tinha explicações pequenas, títulos internos de 52 a 58 px e espaço vazio enquanto colunas estreitas comprimiam o texto. O usuário pediu piso de 15 pt para todo texto e 50 pt para títulos.

**Entrada de regressão:** canvas 1080 × 1350, título com 58 px, apoio com 20 px, três colunas com explicações, foto aprovada e um grande vazio entre título e conteúdo. O DOM não apresenta overflow. Adaptar também a um post e a um Story.

**PASS:** todos os títulos principais, inclusive internos, têm pelo menos 67 CSS px; todos os demais textos têm pelo menos 20 px. Explicações centrais usam uma escala confortável, normalmente 30 a 38 px, e passam pela leitura em telefone. As colunas cedem lugar a linhas largas ou ao fluxo de leitura quando a explicação pede espaço. Título e apoio ficam próximos; a foto recebe espaço proporcional à função. A revisão preserva fotos e marca aprovadas, pode retirar ornamento dispensável e registra inspeção de cada PNG a 100% e em escala de celular. Story respeita a zona segura.

**FAIL:** declarar a peça pronta apenas porque o mínimo técnico passou; usar 20 px em toda explicação para caber; manter título de 58 px; encolher o canvas inteiro; amputar o argumento; ou esconder defeitos na folha de contato.

**Exceção:** um pedido atual pode fixar outra escala ou formato. Registre essa decisão; exemplos antigos e presets não substituem a preferência atual.
