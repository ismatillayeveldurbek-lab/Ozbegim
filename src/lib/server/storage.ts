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
    return readFile(this.resolve(key));
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

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = process.env.STORAGE_DRIVER === "s3" ? new S3Driver() : new LocalDriver();
  return driver;
}

export function newObjectKey(ownerId: string, kind: string) {
  return `u/${ownerId.replace(/[^a-zA-Z0-9]/g, "")}/${kind}-${randomUUID()}`;
}
