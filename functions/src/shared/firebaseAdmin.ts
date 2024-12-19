import admin from "firebase-admin";

admin.initializeApp();

const storageBucket = admin.storage().bucket();

export {admin, storageBucket};
