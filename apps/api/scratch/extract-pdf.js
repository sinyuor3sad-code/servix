const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'C:/Users/Admin/projects/servix/User_Manual_Developer_Portal_Manual_Version_3.pdf';
const outPath = 'C:/Users/Admin/projects/servix/apps/api/scratch/zatca_manual.txt';

async function main() {
  const buf = fs.readFileSync(pdfPath);
  const dataBuffer = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const parser = new PDFParse(dataBuffer, { verbosity: 0 });
  const result = await parser.getText();

  let text = '';
  if (result && result.pages) {
    for (const page of result.pages) {
      text += `\n=== PAGE ${page.pageNumber} ===\n`;
      for (const line of page.lines || []) {
        text += line.text + '\n';
      }
    }
  } else if (typeof result === 'string') {
    text = result;
  } else {
    text = JSON.stringify(result, null, 2);
  }

  fs.writeFileSync(outPath, text.substring(0, 120000), 'utf8');
  console.log('Chars:', text.length);
  console.log('Saved to', outPath);
}

main().catch(e => console.error('Error:', e.message));
