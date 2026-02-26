/**
 * Media Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type { MediaFile, MediaUploadOptions } from "../types";

/**
 * Media API resource
 *
 * @example
 * ```typescript
 * // Upload an image and send as MMS
 * const file = fs.readFileSync('photo.jpg');
 * const media = await sendly.media.upload(file, {
 *   filename: 'photo.jpg',
 *   contentType: 'image/jpeg'
 * });
 *
 * await sendly.messages.send({
 *   to: '+15551234567',
 *   text: 'Check out this photo!',
 *   mediaUrls: [media.url]
 * });
 * ```
 */
export class MediaResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Upload a media file for use in MMS messages
   *
   * @param file - File data as a Buffer or ReadableStream
   * @param options - Upload options (filename, content type)
   * @returns The uploaded media file with URL
   *
   * @example
   * ```typescript
   * const media = await sendly.media.upload(
   *   fs.readFileSync('image.png'),
   *   { filename: 'image.png', contentType: 'image/png' }
   * );
   *
   * console.log(media.url); // https://...
   * ```
   *
   * @throws {ValidationError} If the file is invalid or too large
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async upload(
    file: Buffer | NodeJS.ReadableStream,
    options?: MediaUploadOptions,
  ): Promise<MediaFile> {
    const filename = options?.filename || "upload.jpg";
    const contentType = options?.contentType || "image/jpeg";

    const blob =
      file instanceof Buffer
        ? new Blob([file], { type: contentType })
        : file;

    const form = new FormData();
    form.append("file", blob as Blob, filename);

    return this.http.requestFormData<MediaFile>("/media", form);
  }
}
