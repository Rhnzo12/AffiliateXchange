export const isCloudinaryHost = (url?: string) => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith("cloudinary.com") || u.hostname.endsWith("res.cloudinary.com");
  } catch (e) {
    return false;
  }
};

export const proxiedSrc = (src?: string | null) => {
  if (!src) return src || undefined;

  // Handle legacy normalized paths like /objects/{publicId}
  // Convert them to full Cloudinary URLs before proxying
  if (src.startsWith('/objects/')) {
    const publicId = src.replace('/objects/', '');
    // Use the /objects/ endpoint which has a Cloudinary fallback
    return src;
  }

  try {
    if (isCloudinaryHost(src)) {
      return `/proxy/image?url=${encodeURIComponent(src)}`;
    }
  } catch (e) {
    // fallthrough
  }
  return src;
};

export default proxiedSrc;
