// src/controllers/patientController.js
import { db, auth } from "../config/firebaseConfig.js";
import multer from "multer";
import fs from "fs";
import pdfjs from "pdfjs-dist/legacy/build/pdf.js";

const { getDocument } = pdfjs;

// 🚫 Removed all Web SDK imports like:
//   - signInWithEmailAndPassword, createUserWithEmailAndPassword
//   - getFirestore, collection, query, where, getDocs, doc, setDoc
// ✅ Everything now uses Admin SDK via `db` and `auth`.

const upload = multer({ storage: multer.memoryStorage() });

// --------------------------- PDF → BLOOD PRESSURE ---------------------------
export const uploadBloodPreessure = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!req.file.buffer) return res.status(400).json({ message: "File buffer is missing" });

    const pdfBuffer = new Uint8Array(req.file.buffer);
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    const bloodPressureData = parseBloodPressureData(extractedText);
    if (!bloodPressureData.date || !bloodPressureData.systolic || !bloodPressureData.diastolic || !bloodPressureData.pulse) {
      return res.status(400).json({ message: "Could not extract blood pressure data." });
    }

    const docRef = await db.collection("bloodPressureRecords").add({
      date: bloodPressureData.date,
      systolic: bloodPressureData.systolic,
      diastolic: bloodPressureData.diastolic,
      pulse: bloodPressureData.pulse,
      patientId: req.body.userId,
      doctorId: req.body.docId,
      commented: false,
    });

    res.json({
      message: "PDF data processed and saved successfully!",
      id: docRef.id,
      data: bloodPressureData,
    });
  } catch (error) {
    console.error("🚨 Error processing PDF:", error);
    res.status(500).json({ message: "Error processing PDF", error: error.message });
  }
};

function parseBloodPressureData(text) {
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/); // YYYY-MM-DD
  const bpMatch = text.match(/(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})/); // systolic diastolic pulse
  if (!dateMatch || !bpMatch) return { date: null, systolic: null, diastolic: null, pulse: null };
  return {
    date: dateMatch[1],
    systolic: parseInt(bpMatch[1], 10),
    diastolic: parseInt(bpMatch[2], 10),
    pulse: parseInt(bpMatch[3], 10),
  };
}

// --------------------------- MANUAL BLOOD PRESSURE ---------------------------
export const postBloodPressureData = async (req, res) => {
  try {
    const { systolic, diastolic, pulse, userId, docId } = req.body;
    if (!systolic || !diastolic || !pulse || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const docRef = await db.collection("bloodPressureRecords").add({
      systolic: parseInt(systolic, 10),
      diastolic: parseInt(diastolic, 10),
      pulse: parseInt(pulse, 10),
      patientId: userId,
      doctorId: docId,
      commented: false,
      date: new Date().toISOString(),
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

// --------------------------- PDF → BLOOD SUGAR ---------------------------
export const uploadBloodSugarPdf = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const pdfBuffer = new Uint8Array(req.file.buffer);
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    const bloodSugarData = parseBloodSugarData(extractedText);
    if (!bloodSugarData) return res.status(400).json({ message: "Failed to extract blood sugar data from PDF." });

    const docRef = await db.collection("bloodSugarReports").add({
      patientId: userId,
      doctorId: req.body.docId,
      ...bloodSugarData,
    });

    res.json({
      message: "Blood sugar data extracted and saved successfully!",
      data: bloodSugarData,
      docId: docRef.id,
    });
  } catch (error) {
    console.error("🚨 Error processing PDF:", error);
    res.status(500).json({ message: "Error processing PDF", error: error.message });
  }
};

export const postBloodSugarData = async (req, res) => {
  try {
    const { type, value, userId, docId } = req.body;
    if (!type || !value || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const docRef = await db.collection("bloodSugarReports").add({
      value,
      type,
      patientId: userId,
      doctorId: docId,
      date: new Date().toISOString(),
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

function parseBloodSugarData(text) {
  const data = {};
  const dateMatch = text.match(/Date:\s*([\d\.]+)/);
  if (dateMatch) data.date = dateMatch[1];

  const typeMatch = text.match(/Blood Sugar Type:\s*([^]+?)(?=Value:|$)/);
  if (typeMatch) data.type = typeMatch[1].trim();

  if (data.type && /HbA1c/i.test(data.type)) {
    const valueMatch = text.match(/Value:\s*([\d\.]+)\s*%/);
    if (valueMatch) data.value = parseFloat(valueMatch[1]);
  } else {
    const valueMatch = text.match(/Value:\s*(\d+)\s*mg\/dL/);
    if (valueMatch) data.value = parseInt(valueMatch[1], 10);
  }

  return data;
}

// --------------------------- PDF → LIPID PROFILE ---------------------------
export const uploadLipidProfilePdf = async (req, res) => {
  try {
    const userId = req.body.userId;
    const doctorId = req.body.docId;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const pdfBuffer = new Uint8Array(req.file.buffer);
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    const lipidProfileData = parseLipidProfileData(extractedText);
    if (!lipidProfileData) return res.status(400).json({ message: "Failed to extract lipid profile data from PDF." });

    const docRef = await db.collection("lipidProfileReports").add({
      patientId: userId,
      doctorId,
      commented: false,
      ...lipidProfileData,
    });

    res.json({
      message: "Lipid profile data extracted and saved successfully!",
      data: lipidProfileData,
      docId: docRef.id,
    });
  } catch (error) {
    console.error("🚨 Error processing PDF:", error);
    res.status(500).json({ message: "Error processing PDF", error: error.message });
  }
};

export const postLipidProfileData = async (req, res) => {
  try {
    const { triglycerides, ldl, hdl, cholesterol, userId, docId } = req.body;
    if (!cholesterol || !hdl || !ldl || !triglycerides || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const docRef = await db.collection("lipidProfileReports").add({
      patientId: userId,
      doctorId: docId,
      cholesterol,
      hdl,
      ldl,
      triglycerides,
      commented: false,
      date: new Date().toISOString(),
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

function parseLipidProfileData(text) {
  const data = {};
  const cholesterolMatch = text.match(/Cholesterol, Total\s*(\d+)\s*mg\/dL/);
  const hdlMatch = text.match(/HDL\s*(\d+)\s*mg\/dL/);
  const ldlMatch = text.match(/LDL\s*(\d+)\s*mg\/dL/);
  const triglyceridesMatch = text.match(/Triglycerides\s*(\d+)\s*mg\/dL/);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);

  if (cholesterolMatch) data.cholesterol = cholesterolMatch[1];
  if (hdlMatch) data.hdl = hdlMatch[1];
  if (ldlMatch) data.ldl = ldlMatch[1];
  if (triglyceridesMatch) data.triglycerides = triglyceridesMatch[1];
  if (dateMatch) data.date = dateMatch[1];

  return data;
}

// --------------------------- PDF → FBC ---------------------------
export const uploadFBCPdf = async (req, res) => {
  try {
    const userId = req.body.userId;
    const doctorId = req.body.docId;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const pdfBuffer = new Uint8Array(req.file.buffer);
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    const fbcData = parseFBCData(extractedText);
    if (!fbcData) return res.status(400).json({ message: "Failed to extract FBC data from PDF." });

    const docRef = await db.collection("fbcReports").add({
      patientId: userId,
      doctorId,
      commented: false,
      ...fbcData,
      uploadedAt: new Date().toISOString(),
    });

    res.json({
      message: "FBC data extracted and saved successfully!",
      data: fbcData,
      docId: docRef.id,
    });
  } catch (error) {
    console.error("🚨 Error processing PDF:", error);
    res.status(500).json({ message: "Error processing PDF", error: error.message });
  }
};

export const postFBCData = async (req, res) => {
  try {
    const { platelet, haemoglobin, wbc, rbc, userId, docId } = req.body;
    if (!platelet || !haemoglobin || !wbc || !rbc || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const docRef = await db.collection("fbcReports").add({
      platelet,
      haemoglobin,
      wbc,
      rbc,
      patientId: userId,
      doctorId: docId,
      commented: false,
      date: new Date().toISOString(),
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

function parseFBCData(text) {
  const data = {};
  const rbcMatch = text.match(/RBC:\s*(\d+(\.\d+)?)\s*million\/uL/);
  const wbcMatch = text.match(/WBC:\s*(\d+(\.\d+)?)\s*thousand\/uL/);
  const haemoglobinMatch = text.match(/Haemoglobin:\s*(\d+(\.\d+)?)\s*g\/dL/);
  const plateletMatch = text.match(/Platelet:\s*(\d+(\.\d+)?)\s*thousand\/uL/);
  const dateMatch = text.match(/(\d{4}.\d{2}.\d{2})/);

  if (rbcMatch) data.rbc = rbcMatch[1];
  if (wbcMatch) data.wbc = wbcMatch[1];
  if (haemoglobinMatch) data.haemoglobin = haemoglobinMatch[1];
  if (plateletMatch) data.platelet = plateletMatch[1];
  if (dateMatch) data.date = dateMatch[1];
  return data;
}

// --------------------------- MULTER + LIST PDFs ---------------------------
export const uploadMiddleware = upload.single("pdf");

export const getPdfs = async (req, res) => {
  try {
    const snapshot = await db.collection("pdfs").orderBy("uploadedAt", "desc").get();
    const pdfs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(pdfs);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch PDFs" });
  }
};

// --------------------------- AUTH / PATIENTS ---------------------------
// Utility: generate unique patientId
async function generateUniquePatientId() {
  const gen = () => `PT${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  let id = gen();
  let exists = true;
  while (exists) {
    const snap = await db.collection("patients").where("id", "==", id).limit(1).get();
    exists = !snap.empty;
    if (exists) id = gen();
  }
  return id;
}

export const signupPatient = async (req, res) => {
  const { name, email, mobilenumber, password } = req.body;
  try {
    // Create Firebase Auth user (Admin)
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      // phoneNumber: mobilenumber ? <E.164 string> : undefined, // set if you have a valid E.164 number
    });

    // Create patient doc
    const patientId = await generateUniquePatientId();
    await db.collection("patients").doc(userRecord.uid).set({
      id: patientId,
      name,
      email,
      mobilenumber,
    });

    res.status(201).json({
      user: { uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName },
      patient: { id: patientId, name, email, mobilenumber },
    });
  } catch (error) {
    // Common: auth/email-already-exists
    const status = error.code === "auth/email-already-exists" ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
};

export const loginPatients = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Preferred: use Firebase Auth REST if API key is available to verify password server-side.
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
        return res.status(400).json({ error: data.error?.message || "Login failed" });
      }

      const patientSnap = await db.collection("patients").where("email", "==", email).limit(1).get();
      if (patientSnap.empty) return res.status(400).json({ error: "Patient not found in the database" });

      const patient = patientSnap.docs[0].data();
      return res.status(200).json({
        user: { uid: data.localId, email },
        patient: { id: patient.id, name: patient.name, email: patient.email, mobilenumber: patient.mobilenumber },
        token: data.idToken,
      });
    }

    // Fallback: create a Custom Token (client must exchange it with Web SDK signInWithCustomToken)
    const user = await auth.getUserByEmail(email);
    const customToken = await auth.createCustomToken(user.uid);

    const patientSnap = await db.collection("patients").where("email", "==", email).limit(1).get();
    if (patientSnap.empty) return res.status(400).json({ error: "Patient not found in the database" });
    const patient = patientSnap.docs[0].data();

    return res.status(200).json({
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
      patient: { id: patient.id, name: patient.name, email: patient.email, mobilenumber: patient.mobilenumber },
      customToken, // client should call signInWithCustomToken(customToken)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --------------------------- QUERIES BY DOCTOR ---------------------------
export const getBloodPressureByDoctor = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("bloodPressureRecords").where("doctorId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBloodSugarByDoctor = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("bloodSugarReports").where("doctorId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood sugar records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getFBCByDoctor = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("fbcReports").where("doctorId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching FBC records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getLipidProfileByDoctor = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("lipidProfileReports").where("doctorId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching lipid profile records:", error);
    return res.status(500).json({ error: error.message });
  }
};

// --------------------------- QUERIES BY PATIENT ---------------------------
export const getBloodPressureByPatient = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("bloodPressureRecords").where("patientId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBloodSugarByPatient = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("bloodSugarReports").where("patientId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood sugar records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getFBCByPatient = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("fbcReports").where("patientId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching FBC records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getLipidProfileByPatient = async (req, res) => {
  const id = req.params.id;
  try {
    const snapshot = await db.collection("lipidProfileReports").where("patientId", "==", id).get();
    if (snapshot.empty) return res.status(404).json({ message: "No records found for this doctor" });
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching lipid profile records:", error);
    return res.status(500).json({ error: error.message });
  }
};

// --------------------------- PATIENT LOOKUP ---------------------------
export const getPatient = async (req, res) => {
  const { id } = req.params;
  try {
    const patientDoc = await db.collection("patients").doc(id).get();
    if (!patientDoc.exists) return res.status(404).json({ error: "Patient not found" });
    res.status(200).json({ patient: patientDoc.data() });
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).json({ error: "Failed to fetch patient details" });
  }
};

// --------------------------- BMI + CALORIES ---------------------------
export const postBmiData = async (req, res) => {
  try {
    const { height, weight, bmi, userId } = req.body;
    if (!height || !weight || !bmi || !userId) {
      return res.status(400).json({ message: "Missing required fields: height, weight, bmi, or userId" });
    }

    const docRef = await db.collection("bmiRecords").add({
      userId,
      height,
      weight,
      bmi,
      date: new Date().toISOString(),
    });

    res.status(201).json({
      message: "BMI data saved successfully!",
      data: { userId, height, weight, bmi },
      docId: docRef.id,
    });
  } catch (error) {
    console.error("🚨 Error saving BMI data:", error);
    res.status(500).json({ message: "Error saving BMI data", error: error.message });
  }
};

let calorieData;
try {
  calorieData = JSON.parse(fs.readFileSync("calories.json", "utf8"));
} catch (error) {
  console.error("Error reading calories.json:", error.message);
  process.exit(1);
}

const flattenMeals = (data, prefix = "") => {
  let meals = {};
  for (const key in data) {
    if (typeof data[key] === "object") {
      Object.assign(meals, flattenMeals(data[key], `${prefix}${key} > `));
    } else {
      meals[`${prefix}${key}`] = data[key];
    }
  }
  return meals;
};

const flattenedCalorieData = flattenMeals(calorieData);

export const getMealData = async (req, res) => {
  try {
    res.status(200).json(flattenedCalorieData);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch meals" });
  }
};

export const calculateMealCalories = (req, res) => {
  const { meals } = req.body;
  if (!meals || !Array.isArray(meals)) {
    return res.status(400).json({ error: "Invalid meal selection" });
  }

  let totalCalories = 0;
  meals.forEach(({ meal, quantity }) => {
    if (flattenedCalorieData[meal]) {
      totalCalories += (flattenedCalorieData[meal] / 100) * quantity;
    }
  });

  res.json({ totalCalories });
};

export const calculateDayCalories = (req, res) => {
  const { dayMeals } = req.body;
  if (!dayMeals) return res.status(400).json({ error: "Invalid meal selection" });

  let dailyCalories = 0;
  Object.values(dayMeals).forEach((mealTime) => {
    mealTime.forEach(({ meal, quantity }) => {
      if (flattenedCalorieData[meal]) {
        dailyCalories += (flattenedCalorieData[meal] / 100) * quantity;
      }
    });
  });

  res.json({ dailyCalories });
};

// --------------------------- DOCTOR COMMENTS ---------------------------
export const updateDoctorCommentInBloodPressureRecords = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;

    const recordRef = db.collection("bloodPressureRecords").doc(docId);
    const record = await recordRef.get();
    if (!record.exists) return res.status(404).json({ message: "Record not found" });

    await recordRef.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added successfully." });
  } catch (err) {
    console.error("Error updating comment:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateDoctorCommentInBloodSugarRecords = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;

    const recordRef = db.collection("bloodSugarReports").doc(docId);
    const record = await recordRef.get();
    if (!record.exists) return res.status(404).json({ message: "Record not found" });

    await recordRef.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added successfully." });
  } catch (err) {
    console.error("Error updating comment:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateDoctorCommentInLipidRecords = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;

    const recordRef = db.collection("lipidProfileReports").doc(docId);
    const record = await recordRef.get();
    if (!record.exists) return res.status(404).json({ message: "Record not found" });

    await recordRef.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added successfully." });
  } catch (err) {
    console.error("Error updating comment:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const updateDoctorCommentInFBCRecords = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;

    const recordRef = db.collection("fbcReports").doc(docId);
    const record = await recordRef.get();
    if (!record.exists) return res.status(404).json({ message: "Record not found" });

    await recordRef.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added successfully." });
  } catch (err) {
    console.error("Error updating comment:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
