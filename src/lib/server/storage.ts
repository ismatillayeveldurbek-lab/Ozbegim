/**
 * Yopiq obyekt saqlash. Fayllar hech qachon ommaviy manzilda bo‘lmaydi: yuklab olish faqat
 * egalik tekshiriladigan API orqali.
 *  - local: server diskidagi papka (public/ dan tashqarida)
 *  - s3:    S3 bilan mos xizmat (AWS S3, MinIO, Cloudflare R2 ...) — bucket yopiq bo‘lishi kerak
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  name: string;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

function safeKey(key: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,200}$/.test(key) || key.includes("..")) throw new Error("Noto‘g‘ri saqlash kaliti");
  return key;
}

class LocalDriver implements StorageDriver {
  name = "local";
  private base = path.resolve(process.env.STORAGE_LOCAL_DIR || "./.data/storage");
  private resolve(key: string) {
    const p = path.resolve(this.base, safeKey(key));
    if (!p.startsWith(this.base + path.sep)) throw new Error("Noto‘g‘ri saqlash kaliti");
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
    await writeFile(p, data, { mode: 0o600 });
  }
  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new ObjectMissingError(key);
      throw e;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

class S3Driver implements StorageDriver {
  name = "s3";
  private clientPromise = (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
    });
  })();
  private bucket = process.env.S3_BUCKET ?? "";
  async put(key: string, data: Buffer) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: data }));
  }
  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const r = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }
}

/**
 * Fayl mazmuni PostgreSQL’da (bytea). Doimiy diski bo‘lmagan serverless muhitlar uchun:
 * fayllar kichik (FILE_MAX_MB) va qisqa muddatli bo‘lgani uchun alohida xizmat shart emas.
 */
class DbDriver implements StorageDriver {
  name = "db";
  private async db() {
    return (await import("./db")).prisma;
  }
  async put(key: string, data: Buffer) {
    const prisma = await this.db();
    await prisma.storedBlob.upsert({ where: { key: safeKey(key) }, create: { key, data: new Uint8Array(data) }, update: { data: new Uint8Array(data) } });
  }
  async get(key: string) {
    const prisma = await this.db();
    const row = await prisma.storedBlob.findUnique({ where: { key: safeKey(key) } });
    if (!row) throw new ObjectMissingError(key);
    return Buffer.from(row.data);
  }
  async delete(key: string) {
    const prisma = await this.db();
    await prisma.storedBlob.deleteMany({ where: { key: safeKey(key) } });
  }
}

/** Saqlangan obyekt topilmadi (muddati o‘tgan yoki o‘chirilgan). */
export class ObjectMissingError extends Error {
  constructor(key: string) {
    super(`Saqlangan obyekt topilmadi: ${key}`);
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) {
    const d = process.env.STORAGE_DRIVER;
    driver = d === "s3" ? new S3Driver() : d === "db" ? new DbDriver() : new LocalDriver();
  }
  return driver;
}

export function newObjectKey(ownerId: string, kind: string) {
  return `u/${ownerId.replace(/[^a-zA-Z0-9]/g, "")}/${kind}-${randomUUID()}`;
}
