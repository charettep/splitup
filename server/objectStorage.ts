import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async getObjectEntityUploadURL(): Promise<string> {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage bucket ID not configured");
    }

    const bucket = objectStorageClient.bucket(bucketId);
    const objectPath = `receipts/${randomUUID()}`;
    const file = bucket.file(objectPath);

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: "application/octet-stream",
    });

    return url;
  }

  async getObjectEntityFile(path: string): Promise<File> {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage bucket ID not configured");
    }

    // Remove leading /objects/ if present
    const objectPath = path.replace(/^\/objects\//, "");
    
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectPath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    return file;
  }

  downloadObject(file: File, res: Response): void {
    const readStream = file.createReadStream();
    readStream.on("error", (error) => {
      console.error("Error streaming object:", error);
      res.status(500).send("Error downloading file");
    });
    readStream.pipe(res);
  }
}
