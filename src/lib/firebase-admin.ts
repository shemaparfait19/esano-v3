import {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Initialize Admin SDK once per process
const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: (() => {
        try {
          const b64 = process.env.SERVICE_ACCOUNT_JSON;
          if (b64 && b64.length > 0) {
            const json = JSON.parse(
              Buffer.from(b64, "base64").toString("utf8")
            );
            return cert(json as any);
          }
        } catch (e) {
          // fall through to applicationDefault
        }
        return applicationDefault();
      })(),
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        "esano-ai-genealogy-explorer.appspot.com",
    });

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
