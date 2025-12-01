import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import { Response } from "express";
import { randomUUID } from "crypto";
import * as path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Legacy Google Cloud Storage setup preserved for easy re-enablement
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
//     console.log('[GCS] ⚠️  Initialized with default credentials (may fail if not in GCP environment)');
//   }
// } catch (error) {
//   console.error('[GCS] ❌ Error initializing Google Cloud Storage:', error);
//   throw error;
// }
// const BUCKET_NAME = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || process.env.GCS_FOLDER || "affiliatexchange/videos";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

type ResourceType = 'image' | 'video' | 'raw' | 'auto';

function detectResourceType(publicId: string, fallback: ResourceType = 'auto'): ResourceType {
  const ext = path.extname(publicId).toLowerCase();
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(ext)) return 'video';
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) return 'image';
  return fallback;
}

export class ObjectStorageService {
  constructor() {}

  getStorageFolder(): string {
    return CLOUDINARY_FOLDER;
  }

  private getUploadUrl(resourceType: ResourceType = 'auto') {
    return `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  }

  private buildPublicId(folder: string, fileName: string) {
    return `${folder}/${fileName}`.replace(/\\/g, '/');
  }

  private async uploadStream(buffer: Buffer, options: UploadApiOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      upload.end(buffer);
    });
  }

  async getObjectEntityUploadURL(
    customFolder?: string,
    resourceType: ResourceType = 'auto',
    _clientContentType?: string,
    originalFileName?: string
  ): Promise<{
    uploadUrl: string;
    uploadPreset?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    folder?: string;
    contentType?: string;
    publicId?: string;
  }> {
    const folder = customFolder || this.getStorageFolder();

    let fileExtension = '';
    if (originalFileName) {
      fileExtension = path.extname(originalFileName).toLowerCase();
    } else if (resourceType === 'image') {
      fileExtension = '.jpg';
    } else if (resourceType === 'video') {
      fileExtension = '.mp4';
    }

    const fileName = `${randomUUID()}${fileExtension}`;
    const publicId = this.buildPublicId(folder, fileName);
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign: Record<string, any> = {
      folder,
      public_id: publicId,
      timestamp,
      // resource_type is determined by the upload URL path and should not be included in the
      // signature unless it is also sent as an upload parameter. We keep the signature aligned
      // with the fields actually posted by the client to avoid mismatches.
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ''
    );

    return {
      uploadUrl: this.getUploadUrl(resourceType),
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      signature,
      timestamp,
      publicId,
    };
  }

  async uploadFile(
    filePath: string,
    options?: {
      folder?: string;
      resourceType?: ResourceType;
      publicId?: string;
    }
  ): Promise<any> {
    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || path.basename(filePath);
    const publicId = this.buildPublicId(folder, fileName);

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: options?.resourceType || detectResourceType(fileName),
      public_id: publicId,
    };

    return cloudinary.uploader.upload(filePath, uploadOptions);
  }

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      resourceType?: ResourceType;
      publicId?: string;
    }
  ): Promise<any> {
    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || randomUUID();
    const publicId = this.buildPublicId(folder, fileName);

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: options?.resourceType || detectResourceType(fileName),
      public_id: publicId,
    };

    return this.uploadStream(buffer, uploadOptions);
  }

  getVideoUrl(
    publicId: string,
    options?: {
      quality?: string;
      format?: string;
      transformation?: any[];
    }
  ): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      fetch_format: options?.format,
      quality: options?.quality,
      transformation: options?.transformation,
    });
  }

  getVideoThumbnail(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      format: 'jpg',
      transformation: [{ width: 800, height: 450, crop: 'fill' }],
    });
  }

  async downloadObject(
    publicId: string,
    res: Response,
    _cacheTtlSec: number = 3600
  ) {
    try {
      const url = cloudinary.url(publicId, {
        secure: true,
        sign_url: true,
        resource_type: detectResourceType(publicId, 'auto'),
      });
      res.redirect(url);
    } catch (error) {
      console.error("Error getting Cloudinary URL:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteVideo(publicId: string): Promise<any> {
    return await this.deleteResource(publicId, 'video');
  }

  async deleteImage(publicId: string): Promise<any> {
    return await this.deleteResource(publicId, 'image');
  }

  async deleteResource(publicId: string, resourceType: ResourceType = 'image'): Promise<any> {
    try {
      return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error: any) {
      if (error.http_code === 404) {
        return { result: 'not found' };
      }
      throw error;
    }
  }

  async deleteFolder(folderPath: string): Promise<any> {
    try {
      const { deleted } = await cloudinary.api.delete_resources_by_prefix(folderPath);
      await cloudinary.api.delete_folder(folderPath).catch(() => {});
      console.info(`[ObjectStorage] Deleted resources from folder ${folderPath}`);
      return { deleted };
    } catch (error) {
      const message = (error as any)?.message || JSON.stringify(error);
      throw new Error(message);
    }
  }

  async getVideoInfo(publicId: string): Promise<any> {
    try {
      const resourceType = detectResourceType(publicId, 'auto');
      return await cloudinary.api.resource(publicId, { resource_type: resourceType });
    } catch (error: any) {
      if (error.http_code === 404) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  async searchPublicObject(filePath: string): Promise<any | null> {
    try {
      return await this.getVideoInfo(filePath);
    } catch (error) {
      return null;
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<any> {
    const normalized = this.normalizeObjectEntityPath(objectPath);
    const publicId = normalized.startsWith('/objects/')
      ? normalized.replace('/objects/', '')
      : normalized;
    try {
      return await this.getVideoInfo(publicId);
    } catch (error) {
      throw new ObjectNotFoundError();
    }
  }

  extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
    try {
      if (!cloudinaryUrl.includes('cloudinary.com')) {
        return null;
      }
      const url = new URL(cloudinaryUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const uploadIndex = pathParts.findIndex((p) => p === 'upload');
      if (uploadIndex === -1 || uploadIndex === pathParts.length - 1) return null;
      const publicIdWithVersion = pathParts.slice(uploadIndex + 1).join('/');
      const publicId = publicIdWithVersion.replace(/v\d+\//, '');
      return publicId;
    } catch (error) {
      console.error('[extractPublicIdFromUrl] Error parsing URL:', error);
      return null;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.includes('cloudinary.com')) {
      const publicId = this.extractPublicIdFromUrl(rawPath);
      if (publicId) {
        return '/objects/' + publicId;
      }
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    // Cloudinary assets are managed via delivery type; ACL policy is not applied directly.
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: any;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return true;
  }

  getPublicObjectSearchPaths(): Array<string> {
    return [this.getStorageFolder()];
  }

  getPrivateObjectDir(): string {
    return this.getStorageFolder();
  }
}
