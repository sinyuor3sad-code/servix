declare module 'arabic-reshaper' {
  const ArabicReshaper: {
    convertArabic(text: string): string;
    convertArabicBack(text: string): string;
  };
  export default ArabicReshaper;
}

declare module 'bidi-js' {
  type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  };
  type Bidi = {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevels;
    getReorderSegments(text: string, embeddingLevels: EmbeddingLevels): [number, number][];
  };
  export default function bidiFactory(): Bidi;
}
