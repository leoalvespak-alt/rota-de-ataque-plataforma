# 24 — Humanização com trava factual

**Pedido:** Humanize a copy: “A missão apresenta 12 questões e recomenda revisar o resumo antes da atividade. A duração estimada é de 30 minutos.” Os dados desta fixture estão confirmados.

**Golden case:** “A missão sugere revisar o resumo antes das 12 questões. A atividade tem duração estimada de 30 minutos.”

**PASS:** Mantém 12 questões, a recomendação, a relação temporal e a estimativa de 30 minutos. A redação fica natural sem trocar a estimativa por certeza nem acrescentar promessa.

**FAIL:** Remove ou altera um dado, muda “estimada” para uma certeza, inventa experiência, cria uma estatística, acrescenta uma conclusão de aprovação ou tenta imitar imperfeições para parecer escrita por alguém.
