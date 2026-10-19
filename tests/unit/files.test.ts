import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertFile } from "@/lib/files/convert";
import { detectFile, FileRejectError } from "@/lib/files/detect";
import { convertCsv, convertSrt, convertVtt } from "@/lib/files/formats/text-formats";
import { transformXmlText } from "@/lib/files/ooxml-text";
import { transliterate } from "@/lib/uz/translit";

const L2C = { direction: "lat2cyr" as const };
const tokenize = (s: string) => transliterate(s, { ...L2C, withTokens: true }).tokens!;

const CT = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`;

async function makeDocx(body: string, extra: Record<string, string | Buffer> = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CT);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`);
  for (const [k, v] of Object.entries(extra)) zip.file(k, v);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("DOCX", () => {
  it("run’lar orasida bo‘lingan Sh/O‘ birikmalari va bezaklar saqlanadi", async () => {
    const body =
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
      `<w:r><w:rPr><w:b/></w:rPr><w:t>S</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>hahar</w:t></w:r>` +
      `<w:r><w:t xml:space="preserve"> O</w:t></w:r><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>‘zbek</w:t></w:r></w:p>` +
      `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Choy &amp; non</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
      `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "https://shahar.uz" </w:instrText></w:r><w:r><w:t>havola</w:t></w:r></w:p>`;
    const input = await makeDocx(body);
    const r = await convertFile("docx", "hujjat.docx", input, { direction: "lat2cyr" });
    expect(r.kind).toBe("file");
    if (r.kind !== "file") return;
    expect(r.fileName).toBe("hujjat.kirill.docx");
    const xml = await (await JSZip.loadAsync(r.data)).file("word/document.xml")!.async("string");
    const texts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(texts).toEqual(["Ш", "аҳар", " Ў", "збек", "Чой &amp; нон", "ҳавола"]);
    // Bezaklar, jadval va maydon kodi o‘zgarmadi
    for (const keep of ['<w:jc w:val="center"/>', "<w:b/>", "<w:i/>", '<w:color w:val="FF0000"/>', "<w:tbl><w:tr><w:tc>", 'HYPERLINK "https://shahar.uz"'])
      expect(xml).toContain(keep);
    expect(r.warnings.join(" ")).toContain("Maydon kodlari");
    // Asl bufer o‘zgarmagan
    expect((await (await JSZip.loadAsync(input)).file("word/document.xml")!.async("string"))).toContain("<w:t>S</w:t>");
  });

  it("matn qutisi (ichma-ich paragraf) to‘g‘ri ishlanadi", () => {
    const xml = `<w:p><w:r><w:t>Tosh</w:t></w:r><w:r><w:txbxContent><w:p><w:r><w:t>ichki</w:t></w:r></w:p></w:txbxContent></w:r><w:r><w:t>kent</w:t></w:r></w:p>`;
    const r = transformXmlText(xml, "w:p", "w:t", tokenize);
    expect(r.xml).toBe(`<w:p><w:r><w:t>Тош</w:t></w:r><w:r><w:txbxContent><w:p><w:r><w:t>ички</w:t></w:r></w:p></w:txbxContent></w:r><w:r><w:t>кент</w:t></w:r></w:p>`);
  });
});

describe("PPTX", () => {
  it("slayd matni o‘giriladi, tuzilma saqlanadi", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CT);
    zip.file("ppt/presentation.xml", "<p:presentation/>");
    const slide = `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="uz" b="1"/><a:t>C</a:t></a:r><a:r><a:rPr lang="uz"/><a:t>hoy</a:t></a:r></a:p><a:p><a:pPr algn="ctr"/><a:r><a:t>Yangi yil</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    zip.file("ppt/slides/slide1.xml", slide);
    zip.file("ppt/charts/chart1.xml", "<c:chart><a:t>Diagramma</a:t></c:chart>");
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    expect(detectFile("t.pptx", buf).format).toBe("pptx");
    const r = await convertFile("pptx", "t.pptx", buf, { direction: "auto" });
    if (r.kind !== "file") throw new Error();
    const out = await JSZip.loadAsync(r.data);
    expect(await out.file("ppt/slides/slide1.xml")!.async("string")).toBe(slide.replace("<a:t>C</a:t>", "<a:t>Ч</a:t>").replace("<a:t>hoy</a:t>", "<a:t>ой</a:t>").replace("Yangi yil", "Янги йил"));
    expect(await out.file("ppt/charts/chart1.xml")!.async("string")).toContain("Diagramma");
    expect(r.warnings.join(" ")).toContain("Diagrammalar");
  });
});

describe("XLSX", () => {
  it("formulalar, sonlar, sanalar va varaq nomlari o‘zgarmaydi", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Ma'lumot");
    const date = new Date(Date.UTC(2024, 8, 1));
    ws.getCell("A1").value = "Shahar";
    ws.getCell("A2").value = 42;
    ws.getCell("A3").value = { formula: "A2*2", result: 84 };
    ws.getCell("A4").value = date;
    ws.getCell("A5").value = { richText: [{ text: "S", font: { bold: true } }, { text: "hahar" }] };
    ws.getCell("A6").value = "=SUM(A2:A3)";
    ws.getCell("B1").value = { formula: "UPPER(\"salom\")", result: "SALOM" };
    ws.getCell("A2").numFmt = "0.00";
    const input = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await convertFile("xlsx", "jadval.xlsx", input, { direction: "lat2cyr" });
    if (r.kind !== "file") throw new Error();
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(r.data as unknown as ArrayBuffer);
    const s = out.getWorksheet("Ma'lumot")!;
    expect(s).toBeTruthy();
    expect(s.getCell("A1").value).toBe("Шаҳар");
    expect(s.getCell("A2").value).toBe(42);
    expect(s.getCell("A2").numFmt).toBe("0.00");
    expect(s.getCell("A3").value).toEqual({ formula: "A2*2", result: 84 });
    expect((s.getCell("A4").value as Date).toISOString()).toBe(date.toISOString());
    const rich = s.getCell("A5").value as { richText: Array<{ text: string; font?: { bold?: boolean } }> };
    expect(rich.richText.map((x) => x.text)).toEqual(["Ш", "аҳар"]);
    expect(rich.richText[0].font?.bold).toBe(true);
    // "=" bilan boshlanuvchi matn formula sifatida himoyalanadi
    expect(s.getCell("A6").value).toBe("=SUM(A2:A3)");
    expect((s.getCell("B1").value as { formula: string }).formula).toBe('UPPER("salom")');
  });
});

describe("CSV", () => {
  it("ajratgich, qo‘shtirnoq, ekranlash va qator oxirlari saqlanadi", () => {
    const src = 'nomi;izoh;son\r\n"Shahar";"U ""katta"" shahar";12,5\r\n"ko‘p\nqatorli";oddiy;=A1\r\noxirgi;;\r\n';
    const r = convertCsv(src, L2C);
    expect(r.delimiter).toBe(";");
    expect(r.text).toBe('номи;изоҳ;сон\r\n"Шаҳар";"У ""катта"" шаҳар";12,5\r\n"кўп\nқаторли";оддий;=A1\r\nохирги;;\r\n');
  });
  it("vergul ajratgichli va oxirida qator belgisi yo‘q fayl", () => {
    expect(convertCsv('a,"b,c",d', L2C).text).toBe('а,"б,c",д');
  });
});

describe("Subtitrlar", () => {
  it("SRT vaqt belgilari va raqamlar o‘zgarmaydi, teglar saqlanadi", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Salom</i>, do‘stim!\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n{\\an8}Shahar &amp; qishloq\r\n";
    const r = convertSrt(srt, L2C);
    expect(r.cues).toBe(2);
    expect(r.text).toBe("1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Салом</i>, дўстим!\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n{\\an8}Шаҳар &amp; қишлоқ\r\n");
  });
  it("VTT sarlavha, NOTE, STYLE, cue identifikatori va sozlamalar saqlanadi", () => {
    const vtt = [
      "WEBVTT - Sinov",
      "",
      "STYLE",
      "::cue { color: lime }",
      "",
      "NOTE bu izoh o‘girilmaydi",
      "",
      "kirish-1",
      "00:01.000 --> 00:04.000 align:start line:0",
      "<v Ali>Assalomu alaykum</v>",
      "<c.sariq>Yaxshimisiz?</c>",
      "",
      "00:05.000 --> 00:07.000",
      "Choy <00:06.000>ichamiz",
      "",
    ].join("\n");
    const r = convertVtt(vtt, L2C);
    expect(r.cues).toBe(2);
    expect(r.text).toBe(
      [
        "WEBVTT - Sinov",
        "",
        "STYLE",
        "::cue { color: lime }",
        "",
        "NOTE bu izoh o‘girilmaydi",
        "",
        "kirish-1",
        "00:01.000 --> 00:04.000 align:start line:0",
        "<v Ali>Ассалому алайкум</v>",
        "<c.sariq>Яхшимисиз?</c>",
        "",
        "00:05.000 --> 00:07.000",
        "Чой <00:06.000>ичамиз",
        "",
      ].join("\n"),
    );
  });
});

describe("PDF", () => {
  it("matnli PDF’dan matn ajratiladi va tekshirish uchun qaytariladi", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 300]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Shahar markazida kutubxona ochildi.", { x: 20, y: 250, size: 14, font });
    page.drawText("Yangi kitoblar keltirildi va o'quvchilar xursand.", { x: 20, y: 220, size: 12, font });
    const buf = Buffer.from(await doc.save());
    expect(detectFile("a.pdf", buf).format).toBe("pdf");
    const r = await convertFile("pdf", "a.pdf", buf, { direction: "auto" });
    expect(r.kind).toBe("review");
    if (r.kind !== "review") return;
    expect(r.originalText).toContain("Shahar markazida");
    expect(r.text).toContain("Шаҳар марказида");
  });
  it("matnsiz (skanerlangan) PDF OCR xizmati ulanmaganini aytadi", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const buf = Buffer.from(await doc.save());
    await expect(convertFile("pdf", "s.pdf", buf, { direction: "auto" })).rejects.toMatchObject({ code: "OCR_NOT_CONNECTED" });
  });
});

describe("Fayllarni rad etish", () => {
  const reject = (name: string, buf: Buffer) => {
    try {
      detectFile(name, buf);
    } catch (e) {
      expect(e).toBeInstanceOf(FileRejectError);
      return (e as FileRejectError).code;
    }
    return "OK";
  };

  it("bo‘sh, mos kelmaydigan, eski, makrosli, media va noma’lum formatlar", async () => {
    expect(reject("a.txt", Buffer.alloc(0))).toBe("EMPTY");
    expect(reject("a.txt", Buffer.from("%PDF-1.4 ..."))).toBe("TYPE_MISMATCH");
    expect(reject("a.docx", Buffer.from("oddiy matn"))).toBe("TYPE_MISMATCH");
    expect(reject("a.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]))).toBe("LEGACY");
    expect(reject("a.xlsm", Buffer.from("PK"))).toBe("MACRO");
    expect(reject("a.mp3", Buffer.from("ID3"))).toBe("MEDIA");
    expect(reject("a.exe", Buffer.from("MZ"))).toBe("UNSUPPORTED");
    expect(reject("a.txt", Buffer.from([0x41, 0x00, 0x42]))).toBe("TYPE_MISMATCH");
    expect(reject("a.vtt", Buffer.from("00:01 --> 00:02\nSalom"))).toBe("CORRUPT");
    expect(reject("a.docx", await makeDocx("<w:p/>", { "word/vbaProject.bin": "x" }))).toBe("MACRO");
  });

  it("buzilgan arxiv, ZIP bomb va zararli yo‘llar", async () => {
    expect(reject("a.docx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(100, 7)]))).toBe("ZIP_CORRUPT");
    expect(reject("a.docx", await makeDocx("<w:p/>", { "word/media/bomb.bin": Buffer.alloc(30 * 1024 * 1024, 0) }))).toBe("ZIP_BOMB");
    expect(reject("a.docx", await makeDocx("<w:p/>", { "../../etc/evil.xml": "x" }))).toBe("ZIP_PATH");
    const noCt = new JSZip();
    noCt.file("word/document.xml", "<w:document/>");
    expect(reject("a.docx", await noCt.generateAsync({ type: "nodebuffer" }))).toBe("CORRUPT");
  });

  it("Windows-1251 kodlashdagi kirill TXT o‘qiladi", async () => {
    const cp1251 = Buffer.from([0xd1, 0xe0, 0xeb, 0xee, 0xec]); // "Салом"
    const r = await convertFile("txt", "a.txt", cp1251, { direction: "auto" });
    if (r.kind !== "file") throw new Error();
    expect(r.data.toString("utf8")).toBe("Salom");
    expect(r.warnings[0]).toContain("Windows-1251");
  });
});
