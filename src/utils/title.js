export const meaningfulVideoTitle = (title = '', description = '', maxLength = 58) => {
  const source = String(title || description || 'LeakTok video')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
  if (source.length <= maxLength) return source
  const shortened = source.slice(0, maxLength + 1).replace(/\s+\S*$/, '').trim()
  return shortened || source.slice(0, maxLength).trim()
}
