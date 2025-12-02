export const isCloudinaryHost = (url?: string) => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith("cloudinary.com") ||
           u.hostname.endsWith("res.cloudinary.com");
  } catch (e) {
    return false;
  }
};

export const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.flv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/video/');
};

export const isImageUrl = (url?: string) => {
  if (!url) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.heif'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/image/upload');
};

export const proxiedSrc = (src?: string | null) => {
  if (!src) return src || undefined;

  // Handle legacy normalized paths like /objects/{publicId}
  // Convert them to /public-objects/ for public access (no auth required)
  if (src.startsWith('/objects/')) {
    const publicId = src.replace('/objects/', '');
    // Use the /public-objects/ endpoint which doesn't require authentication
    return `/public-objects/${publicId}`;
  }

  try {
    if (isCloudinaryHost(src)) {
      // For videos, use the video proxy endpoint that supports range requests
      if (isVideoUrl(src)) {
        return `/proxy/video?url=${encodeURIComponent(src)}`;
      }
      // For images, use the image proxy
      if (isImageUrl(src)) {
        return `/proxy/image?url=${encodeURIComponent(src)}`;
      }
      // For other Cloudinary assets (e.g., PDFs), use the generic file proxy
      return `/proxy/file?url=${encodeURIComponent(src)}`;
    }
  } catch (e) {
    // fallthrough
  }
  return src;
};

export default proxiedSrc;
