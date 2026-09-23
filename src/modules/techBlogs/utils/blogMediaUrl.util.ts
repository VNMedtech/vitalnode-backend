/**
 * Sign private S3 media URLs embedded in Tech Blog payloads.
 * Permanent object URLs are stored in DB; signed URLs are returned for display.
 */
import { env } from "../../../config/env.js";
import {
  buildS3ObjectUrl,
  generateSignedDownloadUrl,
} from "../../../infrastructure/s3/index.js";

const BLOG_MEDIA_SIGNED_URL_TTL_SECONDS = Math.max(
  env.aws.signedUrlExpiresInSeconds || 900,
  60 * 60,
);

function getObjectUrlPrefix(): string {
  return `https://${env.aws.bucketName}.s3.${env.aws.region}.amazonaws.com/`;
}

export function extractS3KeyFromObjectUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("amazonaws.com")) return null;

    const prefix = getObjectUrlPrefix();
    const permanent = `${parsed.origin}${parsed.pathname}`;
    if (!permanent.startsWith(prefix)) {
      // path-style: s3.region.amazonaws.com/bucket/key
      const pathStylePrefix = `https://s3.${env.aws.region}.amazonaws.com/${env.aws.bucketName}/`;
      if (!permanent.startsWith(pathStylePrefix)) return null;
      return permanent
        .slice(pathStylePrefix.length)
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/");
    }

    return permanent
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

/** Strip signature query params so we persist stable object URLs. */
export function toPermanentS3ObjectUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("amazonaws.com")) return url;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function normalizeBlogHtmlMediaUrls(html: string): string {
  if (!html) return html;
  return html.replace(
    /\b(src)=["']([^"']+)["']/gi,
    (_match, attr: string, src: string) => {
      const permanent = toPermanentS3ObjectUrl(src) || src;
      return `${attr}="${permanent}"`;
    },
  );
}

async function signObjectUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.includes("X-Amz-Signature=") || url.includes("x-amz-signature=")) {
    return url;
  }

  const key = extractS3KeyFromObjectUrl(url);
  if (!key) return url;

  try {
    return await generateSignedDownloadUrl(key, BLOG_MEDIA_SIGNED_URL_TTL_SECONDS);
  } catch {
    return url;
  }
}

export async function signBlogHtmlMediaUrls(html: string): Promise<string> {
  if (!html) return html;

  const srcPattern = /\b(src)=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(srcPattern)];
  if (!matches.length) return html;

  const uniqueSrcs = [
    ...new Set(
      matches
        .map((match) => match[2])
        .filter((src): src is string => Boolean(src)),
    ),
  ];
  const signedBySrc = new Map<string, string>();

  await Promise.all(
    uniqueSrcs.map(async (src) => {
      const signed = await signObjectUrl(src);
      signedBySrc.set(src, signed || src);
    }),
  );

  return html.replace(srcPattern, (_match, attr: string, src: string) => {
    const signed = signedBySrc.get(src) || src;
    return `${attr}="${signed}"`;
  });
}

export async function signFeaturedImageUrl(
  url: string | null | undefined,
): Promise<string | null> {
  return signObjectUrl(url);
}

export function buildPermanentBlogObjectUrl(key: string): string {
  return buildS3ObjectUrl(key);
}
