export type CloudinaryUploadParams = {
  uploadUrl: string;
  uploadPreset?: string;
  signature?: string;
  timestamp?: number;
  apiKey?: string;
  folder?: string;
  contentType?: string;
  fields?: Record<string, any>;
};

export type CloudinaryUploadResult = {
  secure_url?: string;
  url?: string;
  public_id?: string;
  [key: string]: any;
};

export async function uploadFileToCloudinary(
  uploadData: CloudinaryUploadParams,
  file: File | Blob
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  // Cloudinary preset/signature configuration
  if (uploadData.uploadPreset || uploadData.fields?.upload_preset) {
    formData.append(
      "upload_preset",
      uploadData.uploadPreset || uploadData.fields?.upload_preset
    );
  }

  if (uploadData.signature && uploadData.timestamp && uploadData.apiKey) {
    formData.append("signature", uploadData.signature);
    formData.append("timestamp", uploadData.timestamp.toString());
    formData.append("api_key", uploadData.apiKey);
  }

  // Preserve folder/public ID when provided so URLs remain stable
  if (uploadData.folder) {
    formData.append("folder", uploadData.folder);
  }
  if (uploadData.fields?.public_id) {
    formData.append("public_id", uploadData.fields.public_id);
  }

  // resource_type is part of the endpoint path, but we keep it in comments for easy GCS re-enable
  if (uploadData.fields?.resource_type) {
    formData.append("resource_type", uploadData.fields.resource_type);
  }

  const uploadResult = await fetch(uploadData.uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!uploadResult.ok) {
    const errorText = await uploadResult.text();
    throw new Error(errorText || "Failed to upload file to Cloudinary");
  }

  const cloudinaryResponse: CloudinaryUploadResult = await uploadResult.json();
  return cloudinaryResponse.secure_url || cloudinaryResponse.url || "";
}
