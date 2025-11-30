// === GOOGLE CLOUD STORAGE (COMMENTED) ===
// import { Storage } from '@google-cloud/storage';
// let storage: Storage;
// try {
//   // Option 1: Use credentials from JSON string (best for production/Render)
//   const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
//   if (credentialsJson) {
//     const credentials = JSON.parse(credentialsJson);
//     storage = new Storage({
//       projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
//       credentials,
//     });
//     console.log('[GCS] ✓ Initialized with credentials from GOOGLE_CLOUD_CREDENTIALS_JSON');
//   }
//   // Option 2: Use key file path (for local development)
//   else if (process.env.GOOGLE_CLOUD_KEYFILE) {
//     storage = new Storage({
//       projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
//       keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
//     });
//     console.log('[GCS] ✓ Initialized with key file from GOOGLE_CLOUD_KEYFILE');
//   }
//   // Option 3: Fallback to default credentials (useful for GCP environments)
//   else {
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
// === END GOOGLE CLOUD STORAGE ===

// === CLOUDINARY (ACTIVE) ===
import { v2 as cloudinary } from 'cloudinary';
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
// Cloudinary configuration is handled via environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).
// Switching back to Google Cloud Storage only requires commenting out the Cloudinary section and uncommenting the GCS block above.
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

  getStorageFolder(): string {
    return process.env.CLOUDINARY_FOLDER || process.env.GCS_FOLDER || "affiliatexchange/videos";
  }

  private getContentType(fileName: string, resourceType: string = 'auto'): string {
    const ext = path.extname(fileName).toLowerCase();

    // If resourceType is explicitly set, use it
    if (resourceType === 'video') {
      const videoTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
      };
      return videoTypes[ext] || 'video/mp4';
    }

    if (resourceType === 'image') {
      const imageTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      };
      return imageTypes[ext] || 'image/jpeg';
    }

    // Auto-detect based on extension
    const types: { [key: string]: string } = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return types[ext] || 'application/octet-stream';
  }

  private inferResourceType(publicId: string): 'image' | 'video' | 'raw' {
    const contentType = this.getContentType(publicId);
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('image/')) return 'image';
    return 'raw';
  }

  // === GOOGLE CLOUD STORAGE (COMMENTED) ===
  // async getObjectEntityUploadURL(customFolder?: string, resourceType: string = 'auto', clientContentType?: string, originalFileName?: string): Promise<{
  //   uploadUrl: string;
  //   uploadPreset?: string;
  //   signature?: string;
  //   timestamp?: number;
  //   apiKey?: string;
  //   folder?: string;
  //   contentType?: string;
  //   fields?: { [key: string]: string };
  // }> {
  //   const folder = customFolder || this.getStorageFolder();
  //
  //   // Generate filename with appropriate extension based on resource type or original filename
  //   let fileExtension = '';
  //   if (originalFileName) {
  //     // Preserve the original file extension
  //     fileExtension = path.extname(originalFileName).toLowerCase();
  //   } else if (resourceType === 'image') {
  //     fileExtension = '.jpg'; // Thumbnails are generated as JPEG
  //   } else if (resourceType === 'video') {
  //     fileExtension = '.mp4'; // Default video extension
  //   }
  //
  //   const fileName = `${randomUUID()}${fileExtension}`;
  //   const filePath = `${folder}/${fileName}`;
  //
  //   const bucket = this.getBucket();
  //   const file = bucket.file(filePath);
  //
  //   // Use client-provided content type if available, otherwise detect from filename
  //   const contentType = clientContentType || this.getContentType(fileName, resourceType);
  //
  //   // Generate signed URL for upload (valid for 15 minutes)
  //   const [signedUrl] = await file.getSignedUrl({
  //     version: 'v4',
  //     action: 'write',
  //     expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  //     contentType,
  //   });
  //
  //   console.log('[ObjectStorage] Generated GCS signed upload URL for folder:', folder, 'resourceType:', resourceType, 'contentType:', contentType, 'extension:', fileExtension);
  //
  //   return {
  //     uploadUrl: signedUrl,
  //     folder,
  //     contentType, // Return the content type so frontend uses the exact same one
  //     fields: {
  //       key: filePath,
  //       bucket: BUCKET_NAME,
  //     },
  //   };
  // }
  // === END GOOGLE CLOUD STORAGE ===

  async getObjectEntityUploadURL(customFolder?: string, resourceType: string = 'auto', clientContentType?: string, originalFileName?: string): Promise<{
    uploadUrl: string;
    uploadPreset?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    folder?: string;
    contentType?: string;
    fields?: { [key: string]: string };
  }> {
    const folder = customFolder || this.getStorageFolder();
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const cloudName = cloudinary.config().cloud_name;

    // Generate filename with appropriate extension based on resource type or original filename
    let fileExtension = '';
    if (originalFileName) {
      fileExtension = path.extname(originalFileName).toLowerCase();
    } else if (resourceType === 'image') {
      fileExtension = '.jpg';
    } else if (resourceType === 'video') {
      fileExtension = '.mp4';
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

    // Remove undefined values so signature matches exact payload
    Object.keys(unsignedParams).forEach(key => unsignedParams[key] === undefined && delete unsignedParams[key]);

    const signature = cloudinary.utils.api_sign_request(unsignedParams, cloudinary.config().api_secret || '');

    console.log('[ObjectStorage] Generated Cloudinary upload params for folder:', folder, 'resourceType:', resourceType, 'contentType:', contentType, 'extension:', fileExtension);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      uploadPreset,
      signature,
      timestamp,
      apiKey: cloudinary.config().api_key,
      folder,
      contentType,
      fields: unsignedParams,
    };
  }

  async uploadFile(
    filePath: string,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // const folder = options?.folder || this.getStorageFolder();
    // const fileName = options?.publicId || path.basename(filePath);
    // const destination = `${folder}/${fileName}`;
    //
    // const bucket = this.getBucket();
    // await bucket.upload(filePath, {
    //   destination,
    //   metadata: {
    //     contentType: this.getContentType(filePath, options?.resourceType || 'auto'),
    //   },
    // });
    //
    // const file = bucket.file(destination);
    // const [metadata] = await file.getMetadata();
    //
    // return {
    //   public_id: destination,
    //   secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
    //   url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
    //   resource_type: options?.resourceType || 'auto',
    //   format: path.extname(fileName).substring(1),
    //   ...metadata,
    // };
    // === END GOOGLE CLOUD STORAGE ===

    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || path.basename(filePath);
    const publicId = `${folder}/${fileName}`;

    const uploadResponse = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: options?.resourceType || 'auto',
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

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // const folder = options?.folder || this.getStorageFolder();
    // const fileName = options?.publicId || randomUUID();
    // const destination = `${folder}/${fileName}`;
    //
    // const bucket = this.getBucket();
    // const file = bucket.file(destination);
    //
    // await file.save(buffer, {
    //   metadata: {
    //     contentType: this.getContentType(fileName, options?.resourceType || 'auto'),
    //   },
    // });
    //
    // const [metadata] = await file.getMetadata();
    //
    // return {
    //   public_id: destination,
    //   secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
    //   url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
    //   resource_type: options?.resourceType || 'auto',
    //   format: path.extname(fileName).substring(1),
    //   ...metadata,
    // };
    // === END GOOGLE CLOUD STORAGE ===

    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || randomUUID();
    const publicId = `${folder}/${fileName}`;

    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: options?.resourceType || 'auto',
          overwrite: true,
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
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

      uploadStream.end(buffer);
    });
  }

  getVideoUrl(
    publicId: string,
    options?: {
      quality?: string;
      format?: string;
      transformation?: any[];
    }
  ): string {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // GCS doesn't have built-in transformations like Cloudinary
    // Return the direct URL to the video
    // return `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`;
    // === END GOOGLE CLOUD STORAGE ===

    const transformation = options?.transformation || [];
    if (options?.quality) {
      transformation.push({ quality: options.quality });
    }

    const format = options?.format;

    const url = cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      sign_url: true,
      transformation,
      format,
    });

    return url;
  }

  getVideoThumbnail(publicId: string): string {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // // GCS doesn't auto-generate video thumbnails like Cloudinary
    // // You could either:
    // // 1. Store thumbnails separately when uploading
    // // 2. Use a video thumbnail service
    // // 3. Return a placeholder or the video URL itself
    // // For now, returning the video URL (browsers can show first frame)
    // return `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`;
    // === END GOOGLE CLOUD STORAGE ===

    // Cloudinary provides on-the-fly thumbnails using transformations.
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      sign_url: true,
      format: 'jpg',
      transformation: [
        { width: 480, height: 270, crop: 'fill', gravity: 'auto', quality: 'auto:good' },
        { start_offset: 'auto' },
      ],
    });
  }

  async downloadObject(
    publicId: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      const folder = this.getStorageFolder();
      const possibleIds = [`${folder}/${publicId}`, publicId];
      let info: any | null = null;

      for (const candidate of possibleIds) {
        try {
          info = await this.getVideoInfo(candidate);
          publicId = candidate;
          break;
        } catch (err) {
          continue;
        }
      }

      if (!info) {
        throw new ObjectNotFoundError();
      }

      const signedUrl = cloudinary.url(info.public_id, {
        resource_type: info.resource_type || this.inferResourceType(info.public_id),
        format: info.format,
        secure: true,
        sign_url: true,
        type: 'authenticated',
      });

      res.redirect(signedUrl || info.secure_url || info.url);
    } catch (error) {
      console.error("Error getting video URL:", error);
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

  async deleteResource(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // const bucket = this.getBucket();
    // const file = bucket.file(publicId);
    //
    // try {
    //   await file.delete();
    //   return { result: 'ok' };
    // } catch (error: any) {
    //   if (error.code === 404) {
    //     return { result: 'not found' };
    //   }
    //   throw error;
    // }
    // === END GOOGLE CLOUD STORAGE ===

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result.result === 'not found') {
        return { result: 'not found' };
      }

      return { result: result.result };
    } catch (error: any) {
      if (error?.http_code === 404) {
        return { result: 'not found' };
      }
      throw error;
    }
  }

  async deleteFolder(folderPath: string): Promise<any> {
    try {
      // === GOOGLE CLOUD STORAGE (COMMENTED) ===
      // const bucket = this.getBucket();
      //
      // // List all files in the folder
      // const [files] = await bucket.getFiles({
      //   prefix: folderPath,
      // });
      //
      // // Delete all files
      // await Promise.all(files.map(file => file.delete()));
      //
      // console.info(`[ObjectStorage] Deleted ${files.length} files from folder ${folderPath}`);
      //
      // return { deleted: files.length };
      // === END GOOGLE CLOUD STORAGE ===

      const resourceTypes: Array<'image' | 'video' | 'raw'> = ['image', 'video', 'raw'];
      let deleted = 0;

      for (const resourceType of resourceTypes) {
        const result = await cloudinary.api.delete_resources_by_prefix(folderPath, { resource_type: resourceType });
        deleted += (result.deleted ? Object.keys(result.deleted).length : 0);
      }

      await cloudinary.api.delete_folder(folderPath).catch(() => {});

      console.info(`[ObjectStorage] Deleted ${deleted} resources from folder ${folderPath}`);

      return { deleted };
    } catch (error) {
      const message = (error as any)?.message || JSON.stringify(error);
      throw new Error(message);
    }
  }

  async getVideoInfo(publicId: string): Promise<any> {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // const bucket = this.getBucket();
    // const file = bucket.file(publicId);
    //
    // try {
    //   const [metadata] = await file.getMetadata();
    //   const [exists] = await file.exists();
    //
    //   if (!exists) {
    //     throw new ObjectNotFoundError();
    //   }
    //
    //   return {
    //     public_id: publicId,
    //     format: path.extname(publicId).substring(1),
    //     resource_type: metadata.contentType?.startsWith('video/') ? 'video' :
    //                    metadata.contentType?.startsWith('image/') ? 'image' : 'raw',
    //     bytes: metadata.size,
    //     url: `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`,
    //     secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`,
    //     created_at: metadata.timeCreated,
    //     ...metadata,
    //   };
    // } catch (error: any) {
    //   if (error.code === 404 || error instanceof ObjectNotFoundError) {
    //     throw new ObjectNotFoundError();
    //   }
    //   throw error;
    // }
    // === END GOOGLE CLOUD STORAGE ===

    const resourceType = this.inferResourceType(publicId);

    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      return {
        public_id: resource.public_id,
        format: resource.format,
        resource_type: resource.resource_type,
        bytes: resource.bytes,
        url: resource.secure_url || resource.url,
        secure_url: resource.secure_url || resource.url,
        created_at: resource.created_at,
        ...resource,
      };
    } catch (error: any) {
      if (error?.http_code === 404 || error instanceof ObjectNotFoundError) {
        const fallbackTypes: Array<'image' | 'video' | 'raw'> = ['image', 'video', 'raw'];
        for (const type of fallbackTypes) {
          if (type === resourceType) continue;
          try {
            const resource = await cloudinary.api.resource(publicId, { resource_type: type });
            return {
              public_id: resource.public_id,
              format: resource.format,
              resource_type: resource.resource_type,
              bytes: resource.bytes,
              url: resource.secure_url || resource.url,
              secure_url: resource.secure_url || resource.url,
              created_at: resource.created_at,
              ...resource,
            };
          } catch (innerErr: any) {
            if (innerErr?.http_code !== 404) {
              throw innerErr;
            }
          }
        }
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  async searchPublicObject(filePath: string): Promise<any | null> {
    try {
      const info = await this.getVideoInfo(filePath);
      return info;
    } catch (error) {
      return null;
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<any> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const publicId = objectPath.replace("/objects/", "");

    const folder = this.getStorageFolder();
    const fullPublicId = `${folder}/${publicId}`;

    try {
      const info = await this.getVideoInfo(fullPublicId);
      return info;
    } catch (error) {
      try {
        const info = await this.getVideoInfo(publicId);
        return info;
      } catch (fallbackError) {
        throw new ObjectNotFoundError();
      }
    }
  }

  extractPublicIdFromUrl(storageUrl: string): string | null {
    try {
      // === GOOGLE CLOUD STORAGE (COMMENTED) ===
      // if (!storageUrl.startsWith("https://storage.googleapis.com/")) {
      //   return null;
      // }
      //
      // const url = new URL(storageUrl);
      // const pathParts = url.pathname.split('/').filter(p => p);
      //
      // // First part is bucket name, rest is the file path
      // if (pathParts.length < 2) return null;
      //
      // // Remove bucket name, keep the rest as public ID
      // const publicIdWithExt = pathParts.slice(1).join('/');
      //
      // // Remove extension from last part
      // const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      // const publicId = lastDotIndex > 0 ? publicIdWithExt.substring(0, lastDotIndex) : publicIdWithExt;
      //
      // return publicId;
      // === END GOOGLE CLOUD STORAGE ===

      const url = new URL(storageUrl);
      const hostname = url.hostname;
      const pathParts = url.pathname.split('/').filter(Boolean);

      // Handle Cloudinary URLs: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/v<version>/<folder>/<file>.<ext>
      if (hostname.includes('cloudinary.com')) {
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex >= 0 && uploadIndex + 1 < pathParts.length) {
          const publicIdWithExt = pathParts.slice(uploadIndex + 1).join('/');
          const lastDotIndex = publicIdWithExt.lastIndexOf('.');
          return lastDotIndex > 0 ? publicIdWithExt.substring(0, lastDotIndex) : publicIdWithExt;
        }
      }

      // Fallback: return path without extension
      const lastDotIndex = storageUrl.lastIndexOf('.');
      if (lastDotIndex > storageUrl.lastIndexOf('/')) {
        return storageUrl.substring(0, lastDotIndex).split('/').slice(-1)[0];
      }

      return null;
    } catch (error) {
      console.error('[extractPublicIdFromUrl] Error parsing URL:', error);
      return null;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // === GOOGLE CLOUD STORAGE (COMMENTED) ===
    // if (rawPath.startsWith("https://storage.googleapis.com/")) {
    //   const url = new URL(rawPath);
    //   const pathParts = url.pathname.split('/').filter(p => p);
    //
    //   // Remove bucket name and get file path
    //   if (pathParts.length < 2) return rawPath;
    //
    //   const filePath = pathParts.slice(1).join('/');
    //   const fileName = pathParts[pathParts.length - 1];
    //   const publicId = fileName.split('.')[0];
    //
    //   return '/objects/' + publicId;
    // }
    // === END GOOGLE CLOUD STORAGE ===

    if (rawPath.includes('cloudinary.com')) {
      const publicId = this.extractPublicIdFromUrl(rawPath);
      if (publicId) {
        return `/objects/${publicId}`;
      }
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
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