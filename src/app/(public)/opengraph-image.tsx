import { getPublicContent } from "@/content/public-site";
import {
  createPublicOpenGraphImage,
  publicOpenGraphSize,
} from "@/lib/public-open-graph-image";

export const alt = getPublicContent("bg").metadata.home.title;
export const size = publicOpenGraphSize;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createPublicOpenGraphImage("bg");
}
