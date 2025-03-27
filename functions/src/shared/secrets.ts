import {defineString, defineSecret} from "firebase-functions/params";

export const appId = defineString("APPLICATION_ID");
export const serviceId = defineString("SERVICE_ID");

export const superSecret = defineSecret("SUPER_SECRET");
