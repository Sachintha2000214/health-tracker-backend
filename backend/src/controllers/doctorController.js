// src/controllers/doctorController.js
import { db, auth } from "../config/firebaseConfig.js";

// LOGIN (email/password)
// - If FIREBASE_API_KEY is set, verifies password via Firebase Auth REST and returns an ID token.
// - Otherwise, returns a Custom Token (client must exchange via Web SDK signInWithCustomToken).
export const loginDoctor = async (req, res) => {
  const { email, password } = req.body;
  try {
    let token;
    let uid;

    if (process.env.FIREBASE_API_KEY && password) {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        return res
          .status(400)
          .json({ error: data.error?.message || "Login failed" });
      }
      token = data.idToken;
      uid = data.localId;
    } else {
      // Custom token fallback
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
      token = await auth.createCustomToken(uid);
    }

    // Fetch doctor profile from Firestore
    const snap = await db
      .collection("doctors")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      return res
        .status(400)
        .json({ error: "Doctor not found in the database" });
    }

    const docRef = snap.docs[0];
    const d = docRef.data();
    return res.status(200).json({
      doctor: {
        id: docRef.id,
        name: d.name,
        email: d.email,
        doctornumber: d.doctornumber,
        mobilenumber: d.mobilenumber,
        specialization: d.specialization,
      },
      token,
    });
  } catch (error) {
    console.error("loginDoctor error:", error);
    return res.status(400).json({ error: error.message });
  }
};

// SIGNUP
// - Creates the Auth user with Admin SDK.
// - Stores the doctor document in Firestore (doc id = Auth uid).
export const signupDoctor = async (req, res) => {
  const { name, email, doctornumber, mobilenumber, specialization, password } =
    req.body;

  try {
    // Check if a doctor doc already exists with this email
    const existing = await db
      .collection("doctors")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Create Firebase Auth user (Admin)
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      // phoneNumber: mobilenumber && mobilenumber.startsWith("+") ? mobilenumber : undefined,
    });

    // Store doctor profile (use uid as doc id for easy joins)
    await db.collection("doctors").doc(userRecord.uid).set({
      name,
      email,
      doctornumber,
      mobilenumber,
      specialization,
    });

    return res.status(201).json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
      doctor: {
        id: userRecord.uid,
        name,
        email,
        doctornumber,
        mobilenumber,
        specialization,
      },
    });
  } catch (error) {
    console.error("signupDoctor error:", error);
    const status =
      error.code === "auth/email-already-exists" ? 400 : 400;
    return res.status(status).json({ error: error.message });
  }
};

// LIST ALL DOCTORS
export const getAllDoctors = async (req, res) => {
  try {
    const snap = await db.collection("doctors").get();
    const doctors = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        doctorNumber: data.doctornumber,
        name: data.name,
        email: data.email,
        mobileNumber: data.mobilenumber,
        specialization: data.specialization,
      };
    });
    return res.status(200).json(doctors);
  } catch (error) {
    console.error("getAllDoctors error:", error);
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
};
