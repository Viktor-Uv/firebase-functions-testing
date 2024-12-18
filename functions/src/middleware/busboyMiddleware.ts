import busboy from "busboy";
import {Request} from "express";
import logger from "firebase-functions/logger";

export interface ParsedFileStream {
  filename: string;
  filesizeKb: number;
  mimetype: string;
  stream: NodeJS.ReadableStream;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Parses a single file from a `multipart/form-data` request
 * and provides a stream.
 *
 * @param {Request} req - The HTTP request object
 * @return {Promise<ParsedFileStream>} A promise with the parsed file stream
 */
export const parseFileStream = (req: Request): Promise<ParsedFileStream> => {
  const headers = req.headers;
  const contentType = headers["content-type"];
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    return Promise.reject(
      new Error("Invalid content type. Expected multipart/form-data."),
    );
  }

  return new Promise((resolve, reject) => {
    const bb = busboy({headers});
    let fileProcessed = false;
    let bytesTotal = 0;

    bb.on("file", (fieldname, file, {filename, mimeType}) => {
      if (fileProcessed) {
        // Reject if more than one file is uploaded
        file.resume(); // Discard the stream
        return reject(new Error("Only one file per upload is allowed."));
      }

      // Mark the first file as processed
      fileProcessed = true;

      file.on("data", (chunk) => {
        bytesTotal += chunk.length; // Accumulate chunk size
        if (bytesTotal > MAX_FILE_SIZE_BYTES) {
          file.resume(); // Discard the stream
          return reject(new Error(
            `File size exceeds the limit of ${MAX_FILE_SIZE_MB} MB.`),
          );
        }
      });

      file.on("end", () => {
        const filesize = Math.round(bytesTotal / 1024);

        logger.info("File parsed:", filename, `${filesize}KB`, mimeType);

        resolve({
          filename,
          filesizeKb: filesize,
          mimetype: mimeType,
          stream: file, // Pass the readable stream directly
        });
      });

      file.on("error", (err) => {
        reject(err); // Handle stream errors
      });
    });

    bb.on("finish", () => {
      if (!fileProcessed) {
        reject(new Error("No file uploaded."));
      }
    });

    bb.on("error", (err) => reject(err));

    // Start parsing the request
    bb.end(req.body);
  });
};
