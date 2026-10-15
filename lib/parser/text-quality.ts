export function needsOCR(text: string) {
  const visible = text.replace(/\s/g, "");
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const broken = text.match(/[\uFFFD\u0000-\u0008]/g)?.length ?? 0;
  return letters < 40 || broken > Math.max(2, visible.length * 0.02);
}

export function selectPageText(native: string, recognized: string) {
  if (!recognized.trim()) return native;
  // Short native layers can contain exact contact/source metadata absent from OCR.
  if (!needsOCR(recognized)) return native.trim() ? `${native.trim()}\n\n${recognized.trim()}` : recognized;
  const letters = (value: string) => value.match(/\p{L}/gu)?.length ?? 0;
  return letters(recognized) > letters(native) ? recognized : native;
}
