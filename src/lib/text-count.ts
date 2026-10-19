/** Belgilar va so‘zlar soni (so‘z — harf/raqam ketma-ketligi, so‘z ichidagi apostrof va chiziqcha bilan). */
export function countText(text: string) {
  const chars = [...text].length;
  const words = (text.match(/[\p{L}\p{N}]+(?:[‘’ʻʼ'`-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return { chars, words };
}

export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
