import busboy from "busboy";
import {Request} from "express";

export interface ParsedFileStream {
  fieldname: string;
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
  const bb = busboy({headers: req.headers});

  return new Promise((resolve, reject) => {
    let fileProcessed = false;

    bb.on("file", (fieldname, file, {filename, mimeType}) => {
      if (fileProcessed) {
        // Reject if more than one file is uploaded
        file.resume(); // Discard the stream
        return reject(new Error("One file per upload is allowed."));
      }

      fileProcessed = true;

      resolve({
        fieldname,
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
