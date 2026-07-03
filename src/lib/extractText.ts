import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker url import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return await file.text();
  }
  if (name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let out = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Reconstruct lines using item vertical positions
      let lastY: number | null = null;
      let line = "";
      const lines: string[] = [];
      for (const item of content.items as any[]) {
        const y = item.transform?.[5];
        const str = item.str ?? "";
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          lines.push(line);
          line = str;
        } else {
          line += (line && !line.endsWith(" ") ? " " : "") + str;
        }
        lastY = y;
      }
      if (line) lines.push(line);
      out += lines.join("\n") + "\n";
    }
    return out;
  }
  throw new Error("Unsupported file type. Use TXT, DOCX or PDF.");
}
