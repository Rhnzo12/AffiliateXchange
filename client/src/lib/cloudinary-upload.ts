export type CloudinaryUploadParams = {
  uploadUrl: string;
  apiKey?: string;
  signature?: string;
  timestamp?: number;
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
};

export function uploadToCloudinary(
  uploadParams: CloudinaryUploadParams,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (uploadParams.apiKey) formData.append("api_key", uploadParams.apiKey);
    if (uploadParams.timestamp) formData.append("timestamp", uploadParams.timestamp.toString());
    if (uploadParams.signature) formData.append("signature", uploadParams.signature);
    if (uploadParams.folder) formData.append("folder", uploadParams.folder);
    if (uploadParams.publicId) formData.append("public_id", uploadParams.publicId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadParams.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error("Failed to parse Cloudinary response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));

    xhr.send(formData);
  });
}
