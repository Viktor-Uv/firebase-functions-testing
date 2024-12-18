import {getStorage} from "firebase-admin/storage";
import {ParsedFileStream} from "middleware/busboyMiddleware";

/**
 * Streams a file to Google Cloud Storage, default bucket
 *
 * @param {ParsedFileStream} file - The file stream and metadata
 * @return {Promise<string>} A promise that resolves with uploaded file url
 */
export const upload = async (file: ParsedFileStream): Promise<string> => {
  const storageBucket = getStorage().bucket();
  const gcsFile = storageBucket.file(file.filename);

  return new Promise((resolve, reject) => {
    const writeStream = gcsFile.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    file.stream
      .pipe(writeStream)
      .on("finish", () => {
        gcsFile.makePublic();
        console.log(`File ${file.filename} uploaded to GCS.`);
        resolve(gcsFile.publicUrl());
      })
      .on("error", (err) => {
        console.error(`Error uploading file ${file.filename}:`, err);
        reject(err);
      });
  });
};
