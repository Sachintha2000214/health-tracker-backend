import { db, auth } from "../config/firebaseConfig.js";
import multer from "multer";
import fs from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const upload = multer({ storage: multer.memoryStorage() });

export const uploadBloodPreessure = async (req, res) => {
    try {
      console.log("🚀 Upload PDF function started.");
  
      if (!req.file) {
        console.log("❌ No file uploaded.");
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      console.log("✅ Received File in Backend:", req.file.originalname);
  
      if (!req.file.buffer) {
        console.log("❌ req.file.buffer is missing!");
        return res.status(400).json({ message: "File buffer is missing" });
      }
  
      console.log("📄 Extracting text using `pdfjs-dist`...");
  
      // ✅ Convert Buffer to Uint8Array
      const pdfBuffer = new Uint8Array(req.file.buffer);
  
      // ✅ Load PDF from Buffer
      const loadingTask = getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;
  
      let extractedText = "";
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const textContent = await page.getTextContent();
        extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
      }
  
      console.log("📌 Extracted Text:", extractedText);
  
      // ✅ Parse extracted text
      const bloodPressureData = parseBloodPressureData(extractedText);
      
      if (!bloodPressureData.date || !bloodPressureData.systolic || !bloodPressureData.diastolic || !bloodPressureData.pulse) {
        console.log("❌ Failed to extract valid blood pressure data.");
        return res.status(400).json({ message: "Could not extract blood pressure data." });
      }
      // ✅ Save extracted data to Firebase
      const docRef = await db.collection("bloodPressureRecords").add({
        date: bloodPressureData.date,
        systolic: bloodPressureData.systolic,
        diastolic: bloodPressureData.diastolic,
        pulse: bloodPressureData.pulse,
        patientId: req.body.userId,
        doctorId: req.body.docId,
        commented: false
      });
  
      console.log("✅ Data saved to Firestore with ID:", docRef.id);
  
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
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/); // YYYY-MM-DD format
  const bpMatch = text.match(/(\d{2,3})\s+(\d{2,3})\s+(\d{2,3})/); // Extracts BP values

  if (!dateMatch || !bpMatch) {
    return { date: null, systolic: null, diastolic: null, pulse: null };
  }

  return {
    date: dateMatch[1], // Extracted Date
    systolic: parseInt(bpMatch[1]), // First number (Systolic)
    diastolic: parseInt(bpMatch[2]), // Second number (Diastolic)
    pulse: parseInt(bpMatch[3]), // Third number (Pulse)
  };
}

export const postBloodPressureData = async (req, res) => {
    try {
      const { systolic, diastolic, pulse, userId, docId} = req.body;
  
      if (!systolic || !diastolic || !pulse || !userId) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      // Save to Firestore
      const docRef = await db.collection("bloodPressureRecords").add({
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        pulse: parseInt(pulse),
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

export const uploadBloodSugarPdf = async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfBuffer = new Uint8Array(req.file.buffer);

    // Load PDF from the buffer
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    console.log("📌 Extracted Text:\n", extractedText);  // Log the extracted text for debugging

    // Parse the extracted text for values
    const bloodSugarData = parseBloodSugarData(extractedText);

    if (!bloodSugarData) {
      return res.status(400).json({ message: "Failed to extract blood sugar data from PDF." });
    }

    // Save the extracted data to Firebase Firestore
    const docRef = await db.collection("bloodSugarReports").add({
      patientId:userId,
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
    console.log(req.body)
    const { type, value, userId, docId } = req.body;

    if (!type || !value, !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("bloodSugarReports").add({
      value: value,
      type: type,
      patientId: userId,
      doctorId: docId,
      date: new Date().toISOString(),
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

// Function to Parse Blood Sugar Values from Text
function parseBloodSugarData(text) {
  const data = {};

  // Extract date (format: YYYY.MM.DD)
  const dateMatch = text.match(/Date:\s*([\d\.]+)/);
  if (dateMatch) data.date = dateMatch[1];

  // Extract blood sugar type
  const typeMatch = text.match(/Blood Sugar Type:\s*([^]+?)(?=Value:|$)/);
  if (typeMatch) data.type = typeMatch[1].trim();

  // Determine how to extract the value based on the type
  if (data.type && /HbA1c/i.test(data.type)) {
    // Extract percentage value for HbA1c
    const valueMatch = text.match(/Value:\s*([\d\.]+)\s*%/);
    if (valueMatch) data.value = parseFloat(valueMatch[1]);
  } else {
    // Extract mg/dL value for other types
    const valueMatch = text.match(/Value:\s*(\d+)\s*mg\/dL/);
    if (valueMatch) data.value = parseInt(valueMatch[1]);
  }

  return data;
}
  

export const uploadLipidProfilePdf = async (req, res) => {
  try {
    const userId = req.body.userId; // Ensure the user ID is passed
    const doctorId = req.body.docId;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfBuffer = new Uint8Array(req.file.buffer);

    // Load PDF from the buffer
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }

    console.log("📌 Extracted Text:\n", extractedText);  // Log the extracted text for debugging

    // Parse the extracted text for values
    const lipidProfileData = parseLipidProfileData(extractedText);

    if (!lipidProfileData) {
      return res.status(400).json({ message: "Failed to extract lipid profile data from PDF." });
    }

    // Save the extracted data to Firebase Firestore
    const docRef = await db.collection("lipidProfileReports").add({
      patientId:userId,
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
    console.log(req.body)
    const { triglycerides, ldl, hdl, cholesterol, userId, docId} = req.body;

    if (!cholesterol || !hdl, !ldl || !triglycerides || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("lipidProfileReports").add({
      patientId: userId,
      doctorId: docId,
      cholesterol: cholesterol,
      hdl: hdl,
      ldl: ldl,
      triglycerides: triglycerides,
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

  // Extracting each lipid profile value using RegEx
  const cholesterolMatch = text.match(/Cholesterol, Total\s*(\d+)\s*mg\/dL/);
  const hdlMatch = text.match(/HDL\s*(\d+)\s*mg\/dL/);
  const ldlMatch = text.match(/LDL\s*(\d+)\s*mg\/dL/);
  const triglyceridesMatch = text.match(/Triglycerides\s*(\d+)\s*mg\/dL/);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/); 

  // If matches are found, store them in the `data` object
  if (cholesterolMatch) data.cholesterol = cholesterolMatch[1];
  if (hdlMatch) data.hdl = hdlMatch[1];
  if (ldlMatch) data.ldl = ldlMatch[1];
  if (triglyceridesMatch) data.triglycerides = triglyceridesMatch[1];
  if (dateMatch) data.date = dateMatch[1];

  // Return parsed data object
  return data;
}

export const uploadFBCPdf = async (req, res) => {
  try {
    const userId = req.body.userId; // Ensure user ID is passed in the request
    const doctorId = req.body.docId
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfBuffer = new Uint8Array(req.file.buffer);

    // Load PDF from the buffer
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(" ") + "\n";
    }


    // Parse the extracted data
    const fbcData = parseFBCData(extractedText);

    if (!fbcData) {
      return res.status(400).json({ message: "Failed to extract FBC data from PDF." });
    }

    // Save the extracted data to Firestore
    const docRef = await db.collection("fbcReports").add({
      patientId:userId,
      doctorId: doctorId,
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
    console.log(req.body)
    const { platelet, haemoglobin, wbc, rbc, userId, docId} = req.body;

    if (!platelet || !haemoglobin, !wbc || !rbc || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("fbcReports").add({
      platelet: platelet,
      haemoglobin: haemoglobin,
      wbc: wbc,
      rbc: rbc,
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

// Function to Parse FBC Values from Extracted Text
function parseFBCData(text) {
  const data = {};

  // Extracting RBC, WBC, haemoglobin, Platelet values using RegEx
  const rbcMatch = text.match(/RBC:\s*(\d+(\.\d+)?)\s*million\/uL/);
  const wbcMatch = text.match(/WBC:\s*(\d+(\.\d+)?)\s*thousand\/uL/);
  const haemoglobinMatch = text.match(/Haemoglobin:\s*(\d+(\.\d+)?)\s*g\/dL/);
  const plateletMatch = text.match(/Platelet:\s*(\d+(\.\d+)?)\s*thousand\/uL/);
  const dateMatch = text.match(/(\d{4}.\d{2}.\d{2})/); 

  // Store values in the `data` object if matches are found
  if (rbcMatch) data.rbc = rbcMatch[1];
  if (wbcMatch) data.wbc = wbcMatch[1];
  if (haemoglobinMatch) data.haemoglobin = haemoglobinMatch[1];
  if (plateletMatch) data.platelet = plateletMatch[1];
  if (dateMatch) data.date = dateMatch[1];

  // Return parsed data object
  return data;
}

// Multer middleware for routes
export const uploadMiddleware = upload.single("pdf");

// Get All Uploaded PDFs with Extracted Data
export const getPdfs = async (req, res) => {
    try {
        const snapshot = await db.collection("pdfs").orderBy("uploadedAt", "desc").get();
        const pdfs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json(pdfs);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to fetch PDFs" });
    }
};

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


export const getBloodPressureByDoctor = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("bloodPressureRecords");
    const snapshot = await recordsRef.where('doctorId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBloodSugarByDoctor = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("bloodSugarReports");
    const snapshot = await recordsRef.where('doctorId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getFBCByDoctor = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("fbcReports");
    const snapshot = await recordsRef.where('doctorId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getLipidProfileByDoctor = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("lipidProfileReports");
    const snapshot = await recordsRef.where('doctorId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBloodPressureByPatient = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("bloodPressureRecords");
    const snapshot = await recordsRef.where('patientId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBloodSugarByPatient = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("bloodSugarReports");
    const snapshot = await recordsRef.where('patientId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getFBCByPatient = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("fbcReports");
    const snapshot = await recordsRef.where('patientId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getLipidProfileByPatient = async (req, res) => {
  const id = req.params.id;

  try {
    const recordsRef = db.collection("lipidProfileReports");
    const snapshot = await recordsRef.where('patientId', '==', id).get();

    if (snapshot.empty) {
      console.log('No matching records.');
      return res.status(404).json({ message: 'No records found for this doctor' });
    }

    const records = [];
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching blood pressure records:", error);
    return res.status(500).json({ error: error.message });
  }
};



export const getPatient = async (req, res) => {
    const { id } = req.params;

    try {
        // Query Firestore collection to find the patient by ID
        const patientDoc = await db.collection("patients").doc(id).get();

        if (!patientDoc.exists) {
            return res.status(404).json({ error: "Patient not found" });
        }

        const patientData = patientDoc.data();
        res.status(200).json({ patient: patientData });

    } catch (error) {
        console.error("Error fetching patient details:", error);
        res.status(500).json({ error: "Failed to fetch patient details" });
    }
};

export const postBmiData = async (req, res) => {
  try {
    const { height, weight, bmi, userId } = req.body;

    if (!height || !weight || !bmi || !userId) {
      return res.status(400).json({ message: "Missing required fields: height, weight, bmi, or userId" });
    }

    const heightInMeters = height / 100;

    if (isNaN(heightInMeters) || isNaN(weight) || heightInMeters <= 0 || weight <= 0) {
      return res.status(400).json({ message: "Invalid height or weight" });
    }

    // Save to Firestore
    const docRef = await db.collection("bmiRecords").add({
      userId,
      height, // already in cm
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
    calorieData = JSON.parse(fs.readFileSync('calories.json', 'utf8'));
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

export const getMealData = async(req,res) => {
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
}


export const calculateDayCalories = (req, res) => {
  const { dayMeals } = req.body;
  if (!dayMeals) {
    return res.status(400).json({ error: "Invalid meal selection" });
  }

  let dailyCalories = 0;
  Object.values(dayMeals).forEach(mealTime => {
    mealTime.forEach(({ meal, quantity }) => {
      if (flattenedCalorieData[meal]) {
        dailyCalories += (flattenedCalorieData[meal] / 100) * quantity;
      }
    });
  });

  res.json({ dailyCalories });
}

// patientController.js

export const updateDoctorCommentInBloodPressureRecords = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;

    const recordRef = db.collection("bloodPressureRecords").doc(docId);
    const record = await recordRef.get();

    if (!record.exists) {
      return res.status(404).json({ message: "Record not found" });
    }

    await recordRef.update({
      doctorComment: comment,
      commented: true,
    });

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

    if (!record.exists) {
      return res.status(404).json({ message: "Record not found" });
    }

    await recordRef.update({
      doctorComment: comment,
      commented: true,
    });

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

    if (!record.exists) {
      return res.status(404).json({ message: "Record not found" });
    }

    await recordRef.update({
      doctorComment: comment,
      commented: true,
    });

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

    if (!record.exists) {
      return res.status(404).json({ message: "Record not found" });
    }

    await recordRef.update({
      doctorComment: comment,
      commented: true,
    });

    return res.status(200).json({ message: "Comment added successfully." });
  } catch (err) {
    console.error("Error updating comment:", err);
    return res.status(500).json({ message: "Server error." });
  }
};