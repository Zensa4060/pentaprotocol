import {
  createOgImageResponse,
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
} from "@/lib/createOgImageResponse";

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  return createOgImageResponse();
}
