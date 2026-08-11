export interface ThesisVector { id: string; embedding: number[] }

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!
    leftNorm += left[index]! ** 2
    rightNorm += right[index]! ** 2
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1)
}

export function matchThesis(signalEmbedding: number[], theses: ThesisVector[]) {
  const best = theses.reduce<{ thesisId: string; similarity: number } | null>((current, thesis) => {
    const candidate = { thesisId: thesis.id, similarity: cosineSimilarity(signalEmbedding, thesis.embedding) }
    return !current || candidate.similarity > current.similarity ? candidate : current
  }, null)
  return best && best.similarity >= 0.7 ? best : null
}
