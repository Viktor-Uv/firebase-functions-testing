import busboy from "busboy";
import {Request} from "express";

export interface ParsedFileStream {
  filename: string;
  mimetype: string;
  stream: NodeJS.ReadableStream;
}

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

    bb.on("file", (fieldname, file, {filename, mimeType}) => {
      if (fileProcessed) {
        // Reject if more than one file is uploaded
        file.resume(); // Discard the stream
        return reject(new Error("Only one file per upload is allowed."));
      }

      fileProcessed = true;

      resolve({
        filename,
        mimetype: mimeType,
        stream: file, // Pass the readable stream directly
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
