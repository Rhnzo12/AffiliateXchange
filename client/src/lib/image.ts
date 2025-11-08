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
