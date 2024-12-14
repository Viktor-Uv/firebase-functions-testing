// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// The Firebase Admin SDK to access Firestore.
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {Request, Response} from "express";

initializeApp();

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
  }
);
