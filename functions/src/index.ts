import logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import "shared/firebaseAdmin";
import {appId, serviceId, superSecret} from "shared/secrets";
import {getFirestore} from "firebase-admin/firestore";
import {Request, Response} from "express";

/**
 * Hello World
 */
export const helloWorld = onRequest(
  {secrets: [superSecret]},
  async (request, response: Response) => {
    logger.info("Hello logs!", {structuredData: true});
    logger.info(
      `AppId: ${appId.value()},
    ServiceId: ${serviceId.value()},
    SuperSecret: ${superSecret.value()}`,
    );
    response.send("Hello from Firebase Functions!");
  },
);

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
