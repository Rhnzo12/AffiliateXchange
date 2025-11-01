import { v2 as cloudinary } from 'cloudinary';
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

  getCloudinaryFolder(): string {
    return process.env.CLOUDINARY_FOLDER || "creatorlink/videos";
  }

  getCloudinaryUploadPreset(): string {
    return process.env.CLOUDINARY_UPLOAD_PRESET || "";
  }

  async getObjectEntityUploadURL(): Promise<{
    uploadUrl: string;
    uploadPreset?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    folder?: string;
  }> {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = this.getCloudinaryFolder();
    const uploadPreset = this.getCloudinaryUploadPreset();

    if (uploadPreset) {
      return {
        uploadUrl: 'https://api.cloudinary.com/v1_1/' + process.env.CLOUDINARY_CLOUD_NAME + '/upload',
        uploadPreset,
        folder,
      };
    }

    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );

    return {
      uploadUrl: 'https://api.cloudinary.com/v1_1/' + process.env.CLOUDINARY_CLOUD_NAME + '/upload',
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
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
    const uploadOptions = {
      folder: options?.folder || this.getCloudinaryFolder(),
      resource_type: options?.resourceType || 'auto',
      public_id: options?.publicId,
    };

    return await cloudinary.uploader.upload(filePath, uploadOptions);
  }

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options?.folder || this.getCloudinaryFolder(),
          resource_type: options?.resourceType || 'auto',
          public_id: options?.publicId,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
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
    return cloudinary.url(publicId, {
      resource_type: 'video',
      quality: options?.quality || 'auto',
      format: options?.format,
      transformation: options?.transformation,
    });
  }

  getVideoThumbnail(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 400, height: 300, crop: 'fill' },
        { quality: 'auto' },
      ],
    });
  }

  async downloadObject(
    publicId: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      const folder = this.getCloudinaryFolder();
      let videoUrl;
      
      try {
        videoUrl = cloudinary.url(folder + '/' + publicId, {
          resource_type: 'video',
          secure: true,
        });
      } catch (error) {
        videoUrl = cloudinary.url(publicId, {
          resource_type: 'video',
          secure: true,
        });
      }

      res.redirect(videoUrl);
    } catch (error) {
      console.error("Error getting video URL:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteVideo(publicId: string): Promise<any> {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
  }

  async getVideoInfo(publicId: string): Promise<any> {
    return await cloudinary.api.resource(publicId, {
      resource_type: 'video',
    });
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
    
    const folder = this.getCloudinaryFolder();
    const fullPublicId = folder + '/' + publicId;

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

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("https://res.cloudinary.com/")) {
      const url = new URL(rawPath);
      const pathParts = url.pathname.split('/');
      const publicIdWithExt = pathParts.slice(-1)[0];
      const publicId = publicIdWithExt.split('.')[0];
      return '/objects/' + publicId;
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
    return [this.getCloudinaryFolder()];
  }

  getPrivateObjectDir(): string {
    return this.getCloudinaryFolder();
  }
}
