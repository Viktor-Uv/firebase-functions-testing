import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import fs from "fs";
import path from "path";
import os from "os";
import busboy from "busboy";
import express, {Request, Response} from "express";

initializeApp();

const app = express();
app.use(express.json());

/**
 * Hello World
 */
export const helloWorld = onRequest((request: Request, response: Response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

/**
 * Take the text parameter passed to this HTTP endpoint and insert it into
 * Firestore under the path /messages/{documentId}/original
 */
export const addMessage = onRequest(async (req: Request, res: Response) => {
  // Grab the text parameter.
  const original = req.query.text;
  if (!original || typeof original !== "string") {
    res.status(400).json({
      error: "Missing or invalid 'text' query parameter",
    });
    return;
  }

  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await getFirestore().collection("messages").add({
    original: original,
  });

  // Send back a message that we've successfully written the message
  res.status(201).json({
    result: `Message id: ${writeResult.id} added. Msg text:${original}`,
  });
});

/**
 * Listens for new messages added to /messages/:documentId/original
 * and saves an uppercased version of the message
 * to /messages/:documentId/uppercase
 */
export const makeUppercase = onDocumentCreated(
  "/messages/{documentId}",
  async (event) => {
    if (!event.data) {
      return logger.log("No data found");
    }

    // Grab the current value of what was written to Firestore.
    const original = event.data.data().original;

    // Access the parameter `{documentId}` with `event.params`
    logger.log("Uppercasing", event.params.documentId, original);

    const uppercase = original.toUpperCase();

    // You must return a Promise when performing
    // asynchronous tasks inside a function
    // such as writing to Firestore.
    // Setting an 'uppercase' field in a Firestore document returns a Promise
    return await event.data.ref.set({uppercase}, {merge: true});
  },
);

/**
 * DecodeHex Firebase Function
 */
export const decodeHex = onRequest((request: Request, response: Response) => {
  logger.info("DecodeHex function called", {structuredData: true});

  // Expecting ?hexString=...
  const hexString = request.query.hexString;
  if (!hexString || typeof hexString !== "string") {
    response.status(400).send({
      error: "Invalid input. Provide a 'hexString' as a query parameter.",
    });
    return;
  }

  try {
    const decodedText = decodeHexString(hexString);
    response.status(200).send({decodedText});
  } catch (error) {
    logger.error("Error decoding hex string", error);
    response.status(500).send({
      error: "Failed to decode hex string.",
    });
  }
});

/**
 * Function to decode a hex-encoded string.
 *
 * @param {string} hexString - The hex-encoded string to decode.
 * @return {string} The decoded text.
 */
const decodeHexString = (hexString: string): string => {
  // Split into 4-character chunks (UTF-16 code units)
  const hexPairs = hexString.match(/.{1,4}/g);
  if (!hexPairs) return "";

  return hexPairs
    .map((hex) => String.fromCharCode(parseInt(hex, 16)))
    .join("");
};

/**
 * Parses a single file from 'multipart/form-data'
 * and uploads it to Google Cloud Storage.
 *
 * @param req HTTP request context.
 * @param res HTTP response context.
 */
app.post("/", async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const bb = busboy({headers: req.headers});
  const tmpdir = os.tmpdir();

  let fileProcessed = false; // To track if a file has already been processed
  let uploadFilePath: string;
  let fileName: string;
  const fileWrites: Promise<void>[] = [];

  bb.on("file", (fieldname, file, {filename}) => {
    if (fileProcessed) {
      // If a second file is detected, reject the request
      file.resume(); // Discard the file stream
      res.status(400).send("Only one file upload is allowed.");
      return;
    }

    fileProcessed = true;
    console.log(`Processing file: ${filename}`);

    // Temporary local file path
    uploadFilePath = path.join(tmpdir, filename);
    const writeStream = fs.createWriteStream(uploadFilePath);
    file.pipe(writeStream);

    // Track a file write completion
    const fileWritePromise = new Promise<void>((resolve, reject) => {
      file.on("end", () => writeStream.end());
      writeStream.on("close", resolve);
      writeStream.on("error", reject);
    });
    fileWrites.push(fileWritePromise);
    fileName = filename;
  });

  bb.on("finish", async () => {
    if (!fileProcessed) {
      res.status(400).send("No file uploaded.");
      return;
    }

    try {
      // Wait for file writes to complete
      await Promise.all(fileWrites);

      // Upload the file to Google Cloud Storage
      const storageBucket = getStorage().bucket();
      const destination = path.basename(uploadFilePath); // GCS file name
      await storageBucket.upload(uploadFilePath, {destination});

      console.log(`File uploaded to GCS as ${destination}`);

      // Clean up the local temporary file
      fs.unlinkSync(uploadFilePath);

      const fileRef = storageBucket.file(fileName);
      await fileRef.makePublic();

      return res.status(200).send({url: fileRef.publicUrl()});
    } catch (error) {
      console.error("Error processing file upload:", error);
      return res.status(500).send("Error uploading file.");
    }
  });

  bb.end(req.body);
});

export const uploadFile = onRequest({cors: true}, app);
