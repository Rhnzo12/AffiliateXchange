// === GOOGLE CLOUD STORAGE (COMMENTED) ===
// import { Storage } from '@google-cloud/storage';
// let storage: Storage;
// try {
//   const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
//   if (credentialsJson) {
//     const credentials = JSON.parse(credentialsJson);
//     storage = new Storage({
//       projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
//       credentials,
//     });
//     console.log('[GCS] ✓ Initialized with credentials from GOOGLE_CLOUD_CREDENTIALS_JSON');
//   } else if (process.env.GOOGLE_CLOUD_KEYFILE) {
//     storage = new Storage({
//       projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
//       keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
//     });
//     console.log('[GCS] ✓ Initialized with key file from GOOGLE_CLOUD_KEYFILE');
//   } else {
//     storage = new Storage({
//       projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
//     });
//     console.log('[GCS] ⚠️ Initialized with default credentials');
//   }
// } catch (error) {
//   console.error('[GCS] ❌ Error initializing Google Cloud Storage:', error);
//   throw error;
// }
// const BUCKET_NAME = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';
// === END GOOGLE CLOUD STORAGE ===

// === CLOUDINARY (ACTIVE) ===
import { v2 as cloudinary } from "cloudinary";
import { Response } from "express";
import { randomUUID } from "crypto";
import * as path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
} from "./objectAcl";

// Explicit Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// === END CLOUDINARY ===

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // --------------------------
  // CONFIG VALIDATION HELPERS
  // --------------------------
  private ensureCloudinaryConfigured() {
    const config = cloudinary.config();
    const missing: string[] = [];

    if (!config.cloud_name) missing.push("CLOUDINARY_CLOUD_NAME");
    if (!config.api_key) missing.push("CLOUDINARY_API_KEY");
    if (!config.api_secret) missing.push("CLOUDINARY_API_SECRET");

    if (missing.length > 0) {
      throw new Error(
        `Cloudinary is not fully configured. Missing: ${missing.join(", ")}`
      );
    }

    return config;
  }

  private getUploadPresetOrThrow(): string {
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!uploadPreset) {
      throw new Error(
        "Cloudinary upload preset is not configured. Please set CLOUDINARY_UPLOAD_PRESET."
      );
    }
    return uploadPreset;
  }

  // --------------------------
  // STORAGE UTILITY
  // --------------------------
  getStorageFolder(): string {
    return (
      process.env.CLOUDINARY_FOLDER ||
      process.env.GCS_FOLDER ||
      "affiliatexchange/videos"
    );
  }

  private getContentType(fileName: string, resourceType: string = "auto"): string {
    const ext = path.extname(fileName).toLowerCase();

    if (resourceType === "video") {
      const videoTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
      };
      return videoTypes[ext] || "video/mp4";
    }

    if (resourceType === "image") {
      const imageTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      return imageTypes[ext] || "image/jpeg";
    }

    const types: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return types[ext] || "application/octet-stream";
  }

  private inferResourceType(publicId: string): "image" | "video" | "raw" {
    const contentType = this.getContentType(publicId);
    if (contentType.startsWith("video/")) return "video";
    if (contentType.startsWith("image/")) return "image";
    return "raw";
  }

  // --------------------------
  // SIGNED UPLOAD URL
  // --------------------------
  async getObjectEntityUploadURL(
    customFolder?: string,
    resourceType: string = "auto",
    clientContentType?: string,
    originalFileName?: string
  ) {
    const config = this.ensureCloudinaryConfigured();
    const uploadPreset = this.getUploadPresetOrThrow();

    const folder = customFolder || this.getStorageFolder();
    const cloudName = config.cloud_name;

    let fileExtension = "";
    if (originalFileName) {
      fileExtension = path.extname(originalFileName).toLowerCase();
    } else if (resourceType === "image") {
      fileExtension = ".jpg";
    } else if (resourceType === "video") {
      fileExtension = ".mp4";
    }

    const fileName = `${randomUUID()}${fileExtension}`;
    const publicId = `${folder}/${fileName}`;
    const contentType = clientContentType || this.getContentType(fileName, resourceType);

    const timestamp = Math.round(Date.now() / 1000);

    const unsignedParams: Record<string, any> = {
      timestamp,
      folder,
      public_id: publicId,
      resource_type: resourceType,
      upload_preset: uploadPreset,
    };

    Object.keys(unsignedParams).forEach(
      (key) => unsignedParams[key] === undefined && delete unsignedParams[key]
    );

    const signature = cloudinary.utils.api_sign_request(
      unsignedParams,
      config.api_secret || ""
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      uploadPreset,
      signature,
      timestamp,
      apiKey: config.api_key,
      folder,
      contentType,
      fields: unsignedParams,
    };
  }

  // --------------------------
  // UPLOAD FILE
  // --------------------------
  async uploadFile(filePath: string, options?: any): Promise<any> {
    this.ensureCloudinaryConfigured();

    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || path.basename(filePath);
    const publicId = `${folder}/${fileName}`;

    const uploadResponse = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: options?.resourceType || "auto",
      use_filename: false,
      unique_filename: false,
      overwrite: true,
    });

    return {
      public_id: uploadResponse.public_id,
      secure_url: uploadResponse.secure_url,
      url: uploadResponse.url,
      resource_type: uploadResponse.resource_type,
      format: uploadResponse.format,
      bytes: uploadResponse.bytes,
      created_at: uploadResponse.created_at,
      ...uploadResponse,
    };
  }

  // --------------------------
  // UPLOAD BUFFER
  // --------------------------
  async uploadBuffer(buffer: Buffer, options?: any): Promise<any> {
    this.ensureCloudinaryConfigured();

    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || randomUUID();
    const publicId = `${folder}/${fileName}`;

    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: options?.resourceType || "auto",
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            public_id: result?.public_id,
            secure_url: result?.secure_url,
            url: result?.url,
            resource_type: result?.resource_type,
            format: result?.format,
            bytes: result?.bytes,
            created_at: result?.created_at,
            ...result,
          });
        }
      );
      stream.end(buffer);
    });
  }

  // --------------------------
  // VIDEO URL + THUMBNAIL
  // --------------------------
  getVideoUrl(publicId: string, options?: any): string {
    this.ensureCloudinaryConfigured();

    const transformation = options?.transformation || [];
    if (options?.quality) {
      transformation.push({ quality: options.quality });
    }

    return cloudinary.url(publicId, {
      resource_type: "video",
      secure: true,
      sign_url: true,
      transformation,
      format: options?.format,
    });
  }

  getVideoThumbnail(publicId: string): string {
    this.ensureCloudinaryConfigured();

    return cloudinary.url(publicId, {
      resource_type: "video",
      secure: true,
      sign_url: true,
      format: "jpg",
      transformation: [
        {
          width: 480,
          height: 270,
          crop: "fill",
          gravity: "auto",
          quality: "auto:good",
        },
        { start_offset: "auto" },
      ],
    });
  }

  // --------------------------
  // DOWNLOAD OBJECT (SIGNED)
  // --------------------------
  async downloadObject(publicId: string, res: Response, cacheTtlSec: number = 3600) {
    this.ensureCloudinaryConfigured();

    try {
      const folder = this.getStorageFolder();
      const possible = [`${folder}/${publicId}`, publicId];

      let info: any = null;

      for (const id of possible) {
        try {
          info = await this.getVideoInfo(id);
          publicId = id;
          break;
        } catch {}
      }

      if (!info) throw new ObjectNotFoundError();

      const signedUrl = cloudinary.url(info.public_id, {
        resource_type: info.resource_type || this.inferResourceType(info.public_id),
        format: info.format,
        secure: true,
        sign_url: true,
        type: "authenticated",
      });

      res.redirect(signedUrl || info.secure_url || info.url);
    } catch (error) {
      console.error("Error getting video URL:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // --------------------------
  // DELETE
  // --------------------------
  async deleteResource(publicId: string, resourceType: "image" | "video" | "raw" = "image") {
    this.ensureCloudinaryConfigured();

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result.result === "not found") return { result: "not found" };
      return { result: result.result };
    } catch (err: any) {
      if (err?.http_code === 404) return { result: "not found" };
      throw err;
    }
  }

  async deleteVideo(id: string) {
    return this.deleteResource(id, "video");
  }

  async deleteImage(id: string) {
    return this.deleteResource(id, "image");
  }

  async deleteFolder(folderPath: string): Promise<any> {
    try {
      const resourceTypes: Array<"image" | "video" | "raw"> = [
        "image",
        "video",
        "raw",
      ];

      let deleted = 0;

      for (const type of resourceTypes) {
        const result = await cloudinary.api.delete_resources_by_prefix(folderPath, {
          resource_type: type,
        });

        deleted += result.deleted ? Object.keys(result.deleted).length : 0;
      }

      await cloudinary.api.delete_folder(folderPath).catch(() => {});

      return { deleted };
    } catch (err) {
      throw new Error((err as any)?.message || JSON.stringify(err));
    }
  }

  // --------------------------
  // GET RESOURCE INFO
  // --------------------------
  async getVideoInfo(publicId: string): Promise<any> {
    const resourceType = this.inferResourceType(publicId);

    try {
      return await cloudinary.api.resource(publicId, { resource_type: resourceType });
    } catch (err: any) {
      if (err?.http_code !== 404) throw err;

      const fallbacks: Array<"image" | "video" | "raw"> = ["image", "video", "raw"];
      for (const type of fallbacks) {
        if (type === resourceType) continue;
        try {
          return await cloudinary.api.resource(publicId, { resource_type: type });
        } catch (innerErr: any) {
          if (innerErr?.http_code !== 404) throw innerErr;
        }
      }

      throw new ObjectNotFoundError();
    }
  }

  // --------------------------
  // SEARCH
  // --------------------------
  async searchPublicObject(filePath: string) {
    try {
      return await this.getVideoInfo(filePath);
    } catch {
      return null;
    }
  }

  async getObjectEntityFile(raw: string) {
    if (!raw.startsWith("/objects/")) throw new ObjectNotFoundError();

    const publicId = raw.replace("/objects/", "");
    const folderId = `${this.getStorageFolder()}/${publicId}`;

    try {
      return await this.getVideoInfo(folderId);
    } catch {
      return await this.getVideoInfo(publicId);
    }
  }

  // --------------------------
  // PARSE PUBLIC ID FROM URL
  // --------------------------
  extractPublicIdFromUrl(urlStr: string): string | null {
    try {
      const url = new URL(urlStr);
      const parts = url.pathname.split("/").filter(Boolean);

      if (url.hostname.includes("cloudinary.com")) {
        const UploadIdx = parts.indexOf("upload");
        if (UploadIdx >= 0 && UploadIdx + 1 < parts.length) {
          const file = parts.slice(UploadIdx + 1).join("/");
          const dot = file.lastIndexOf(".");
          return dot > 0 ? file.slice(0, dot) : file;
        }
      }

      const dot = urlStr.lastIndexOf(".");
      if (dot > urlStr.lastIndexOf("/")) {
        return urlStr.substring(0, dot).split("/").pop() || null;
      }

      return null;
    } catch (err) {
      console.error("[extractPublicIdFromUrl] Error:", err);
      return null;
    }
  }

  normalizeObjectEntityPath(raw: string): string {
    if (raw.includes("cloudinary.com")) {
      const publicId = this.extractPublicIdFromUrl(raw);
      if (publicId) return `/objects/${publicId}`;
    }
    return raw;
  }

  // --------------------------
  // ACL PLACEHOLDERS
  // --------------------------
  async trySetObjectEntityAclPolicy(rawPath: string) {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity() {
    return true;
  }

  getPublicObjectSearchPaths() {
    return [this.getStorageFolder()];
  }

  getPrivateObjectDir() {
    return this.getStorageFolder();
  }
}
