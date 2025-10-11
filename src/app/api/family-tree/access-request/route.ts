import { NextApiRequest, NextApiResponse } from "next";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // ✅ Verify HTTP method
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ✅ Check auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);
    const fromUserId = decoded.uid;

    // ✅ Validate body
    const { toUserId } = req.body;
    if (!toUserId) {
      return res
        .status(400)
        .json({ error: "Missing 'toUserId' in request body" });
    }
    if (toUserId === fromUserId) {
      return res
        .status(400)
        .json({ error: "You cannot send a request to yourself" });
    }

    // ✅ Check if a pending request already exists
    const existingQuery = db
      .collection("connectionRequests")
      .where("fromUserId", "==", fromUserId)
      .where("toUserId", "==", toUserId)
      .where("status", "==", "pending");

    const existingSnap = await existingQuery.get();
    if (!existingSnap.empty) {
      return res
        .status(400)
        .json({ error: "A pending request already exists" });
    }

    // ✅ Create new connection request
    await db.collection("connectionRequests").add({
      fromUserId,
      toUserId,
      status: "pending",
      createdAt: Timestamp.now(),
    });

    return res.status(200).json({
      success: true,
      message: "Access request sent successfully",
    });
  } catch (err: any) {
    console.error("Error sending access request:", err);
    return res.status(500).json({
      error: "Failed to send access request",
      details: err.message,
    });
  }
}
