import { db, auth } from "../config/firebaseConfig.js";
import multer from "multer";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getDocument } from "pdfjs-dist";

const upload = multer({ storage: multer.memoryStorage() });
const firestore = getFirestore();

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
        patientId: req.body.userId
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
      const { systolic, diastolic, pulse, userId } = req.body;
  
      if (!systolic || !diastolic || !pulse || !userId) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      // Save to Firestore
      const docRef = await db.collection("bloodPressureRecords").add({
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        pulse: parseInt(pulse),
        patientId: userId,
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
      userId,
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
    const { type, value, userId } = req.body;

    if (!type || !value, !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("bloodSugarReports").add({
      value: value,
      type: type,
      userId: userId
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

// Function to Parse Blood Sugar Values from Text
function parseBloodSugarData(text) {
  const data = {};

  // Extracting each Blood Sugar type and value using RegEx
  const fastingMatch = text.match(/Fasting Blood Sugar\s*(\d+)\s*mg\/dL/);
  const postprandialMatch = text.match(/Postprandial Blood Sugar\s*(\d+)\s*mg\/dL/);
  const randomMatch = text.match(/Random Blood Sugar\s*(\d+)\s*mg\/dL/);
  const hbA1cMatch = text.match(/HbA1c\s*([\d\.]+)\s*%/);

  // If matches are found, store them in the `data` object
  if (fastingMatch) data.fastingBloodSugar = fastingMatch[1];
  if (postprandialMatch) data.postprandialBloodSugar = postprandialMatch[1];
  if (randomMatch) data.randomBloodSugar = randomMatch[1];
  if (hbA1cMatch) data.hbA1c = hbA1cMatch[1];

  // Return parsed data object
  return data;
}  

export const uploadLipidProfilePdf = async (req, res) => {
  try {
    const userId = req.body.userId; // Ensure the user ID is passed

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
      userId,
      ...lipidProfileData,
      uploadedAt: new Date().toISOString(),
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
    const { triglycerides, ldl, hdl, cholesterol, userId} = req.body;

    if (!cholesterol || !hdl, !ldl || !triglycerides || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("lipidProfileReports").add({
      patientId: userId,
      cholesterol: cholesterol,
      hdl: hdl,
      ldl: ldl,
      triglycerides: triglycerides,
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

  // If matches are found, store them in the `data` object
  if (cholesterolMatch) data.cholesterol = cholesterolMatch[1];
  if (hdlMatch) data.hdl = hdlMatch[1];
  if (ldlMatch) data.ldl = ldlMatch[1];
  if (triglyceridesMatch) data.triglycerides = triglyceridesMatch[1];

  // Return parsed data object
  return data;
}

export const uploadFBCPdf = async (req, res) => {
  try {
    const userId = req.body.userId; // Ensure user ID is passed in the request
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
    const { platelet, hemoglobin, wbc, rbc, userId} = req.body;

    if (!platelet || !hemoglobin, !wbc || !rbc || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to Firestore
    const docRef = await db.collection("fbcReports").add({
      platelet: platelet,
      hemoglobin: hemoglobin,
      wbc: wbc,
      rbc: rbc,
      patientId: userId,
    });

    res.json({ message: "Manual data saved successfully!", id: docRef.id });
  } catch (error) {
    res.status(500).json({ message: "Error saving data", error: error.message });
  }
};

// Function to Parse FBC Values from Extracted Text
function parseFBCData(text) {
  const data = {};

  // Extracting RBC, WBC, Hemoglobin, Platelet values using RegEx
  const rbcMatch = text.match(/RBC:\s*(\d+(\.\d+)?)\s*million\/uL/);
  const wbcMatch = text.match(/WBC:\s*(\d+(\.\d+)?)\s*thousand\/uL/);
  const hemoglobinMatch = text.match(/Hemoglobin:\s*(\d+(\.\d+)?)\s*g\/dL/);
  const plateletMatch = text.match(/Platelet:\s*(\d+(\.\d+)?)\s*thousand\/uL/);

  // Store values in the `data` object if matches are found
  if (rbcMatch) data.rbc = rbcMatch[1];
  if (wbcMatch) data.wbc = wbcMatch[1];
  if (hemoglobinMatch) data.hemoglobin = hemoglobinMatch[1];
  if (plateletMatch) data.platelet = plateletMatch[1];

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
    const q = query(collection(firestore, 'patients'), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const generatePatientId = () => `PT${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    let patientId = generatePatientId();
    const existingIdQuery = query(collection(firestore, 'patients'), where('id', '==', patientId));
    let idExists = !(await getDocs(existingIdQuery)).empty;
    while ('idExists') {
      patientId = generatePatientId();
      idExists = !(await getDocs(query(collection(firestore, 'patients'), where('id', '==', patientId)))).empty;
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const patientRef = doc(collection(firestore, 'patients'));
    await setDoc(patientRef, { 
      id: patientId,
      name, 
      email, 
      mobilenumber 
    });

    res.status(201).json({ 
      user: userCredential.user, 
      patient: { id: patientId, name, email, mobilenumber } 
    });
};

  
export const loginPatients = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Generate token for authenticated user
    const token = await userCredential.user.getIdToken();

    // Query the 'patients' collection to get the patient data
    const patientRef = collection(firestore, 'patients');
    const docSnapshot = await getDocs(query(patientRef, where('email', '==', email)));

    if (docSnapshot.empty) {
      return res.status(400).json({ error: 'Patient not found in the database' });
    }

    // Extract patient data
    const patientData = docSnapshot.docs[0].data();

    res.status(200).json({ 
      user: userCredential.user, 
      patient: { 
        id: patientData.id, // Include the unique patient ID
        name: patientData.name, 
        email: patientData.email, 
        mobilenumber: patientData.mobilenumber 
      },
      token 
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
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