import mammoth from "mammoth";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamically imported: pdfjs-dist's legacy Node build is ESM-only and
  // fairly heavy, so it's only loaded when a PDF actually needs parsing.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pageTexts.join("\n");
}

/** Extracts plain text from an uploaded document, dispatching by file type. */
export async function extractText(
  fileBase64: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const buffer = Buffer.from(fileBase64, "base64");
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File too large (${Math.round(buffer.length / 1024 / 1024)}MB, max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`,
    );
  }

  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (mimeType === "application/pdf" || extension === "pdf") {
    return extractPdfText(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (extension === "doc") {
    throw new Error("Il formato .doc (Word legacy) non è supportato: converti in .docx o .pdf");
  }

  // Plain text, markdown, or anything else assumed to be UTF-8 text.
  return buffer.toString("utf-8");
}
