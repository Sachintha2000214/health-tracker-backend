// src/controllers/patientController.js (ESM, Node/Lambda safe)
import { db, auth } from "../config/firebaseConfig.js";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ----------------------------------------------------------------------------
// ESM-friendly __dirname and calories.json loader
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Change from:
// calorieData = JSON.parse(
//   await readFile(path.join(__dirname, '../../calories.json'), 'utf-8'))
// To a robust, ESM-safe version without fragile top-level await:
const calorieDataPromise = (async () => {
  try {
    const caloriesPath = path.resolve(__dirname, "../../calories.json");
    const txt = await readFile(caloriesPath, "utf-8");
    return JSON.parse(txt);
  } catch (e) {
    console.warn("calories.json load skipped:", e?.message);
    return {};
  }
})();

// If you need the data in a handler: `const calorieData = await calorieDataPromise;`

// ----------------------------------------------------------------------------
// Multer (memory) for PDF uploads
// ----------------------------------------------------------------------------
export const upload = multer({ storage: multer.memoryStorage() });

// ----------------------------------------------------------------------------
// Helpers: extract text & parsers
// ----------------------------------------------------------------------------
async function extractTextFromPdf(pdf) {
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    text += items.map((it) => it.str).join(" ") + "\n";
  }
  return text;
}

function parseBloodPressure(text) {
  const data = {};
  const sys = text.match(/Systolic\s*[:\-–]?\s*(\d{2,3})/i);
  const dia = text.match(/Diastolic\s*[:\-–]?\s*(\d{2,3})/i);
  const pulse = text.match(/Pulse\s*[:\-–]?\s*(\d{2,3})/i);
  if (sys) data.systolic = parseInt(sys[1], 10);
  if (dia) data.diastolic = parseInt(dia[1], 10);
  if (pulse) data.pulse = parseInt(pulse[1], 10);
  return data;
}

function parseBloodSugar(text) {
  const data = {};
  const fasting = text.match(/(?:FBS|Fasting(?:\s*Blood\s*Sugar)?)\s*[:\-–]?\s*(\d{2,3})\s*mg\/dL/i);
  const pp = text.match(/(?:PPBS|Post\s*Prandial)\s*[:\-–]?\s*(\d{2,3})\s*mg\/dL/i);
  const hbA1c = text.match(/HbA1c\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*%/i);
  const random = text.match(/(?:RBS|Random)\s*[:\-–]?\s*(\d{2,3})\s*mg\/dL/i);
  if (fasting) {
    data.type = "FBS";
    data.value = parseInt(fasting[1], 10);
    data.unit = "mg/dL";
    data.fasting = data.value;
  }
  if (pp) data.pp = parseInt(pp[1], 10);
  if (hbA1c) data.hbA1c = parseFloat(hbA1c[1]);
  if (!fasting && random) {
    data.type = "RBS";
    data.value = parseInt(random[1], 10);
    data.unit = "mg/dL";
  }
  return data;
}

function parseLipidProfile(text) {
  const pick = (re) => {
    const m = text.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  return {
    totalCholesterol: pick(/(?:Total\s*Cholesterol|TC)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    hdl: pick(/HDL\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    ldl: pick(/LDL\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    triglycerides: pick(/(?:Triglycerides|TG)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    vldl: pick(/VLDL\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    ratioTcHdl: pick(/(?:TC\/HDL|TC\s*[:\-–]\s*HDL)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
  };
}

function parseFBC(text) {
  const num = "(\\d+(?:\\.\\d+)?)";
  const pick = (re) => {
    const m = text.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  return {
    hemoglobin: pick(new RegExp("(?:(?:Hemoglobin|Hb))\\s*[:\\-–]?\\s*" + num + "\\s*g\\/dL", "i")),
    wbc: pick(/(?:WBC|White\s*Blood\s*Cells|Leukocytes)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    rbc: pick(/(?:RBC|Red\s*Blood\s*Cells)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    platelets: pick(/(?:Platelets|PLT)\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i),
    hematocrit: pick(/(?:Hematocrit|HCT|PCV)\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*%/i),
    mcv: pick(/MCV\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*fL/i),
    mch: pick(/MCH\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*pg/i),
    mchc: pick(/MCHC\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*g\/dL/i),
  };
}

// ----------------------------------------------------------------------------
// Controllers
// ----------------------------------------------------------------------------
export const uploadBloodPressure = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "No file uploaded" });

    const pdf = await pdfjsLib
      .getDocument({
        data: new Uint8Array(req.file.buffer),
        disableWorker: true,
        isEvalSupported: false,
      })
      .promise;

    const text = await extractTextFromPdf(pdf);
    const parsed = parseBloodPressure(text);

    const docRef = db.collection("bloodPressureReports").doc();
    await docRef.set({
      userId: req.body.userId || null,
      ...parsed,
      rawText: text,
      uploadedAt: new Date().toISOString(),
      fileName: req.file.originalname || "uploaded.pdf",
    });

    // Example usage (if needed): const calorieData = await calorieDataPromise;
    return res.status(200).json({ message: "OK", data: parsed, docId: docRef.id });
  } catch (err) {
    console.error("BP error:", err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};

// Keep the old misspelled export for backward-compat routes, if any:
export const uploadBloodPreessure = uploadBloodPressure;

export const uploadBloodSugarPdf = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "No file uploaded" });

    const pdf = await pdfjsLib
      .getDocument({
        data: new Uint8Array(req.file.buffer),
        disableWorker: true,
        isEvalSupported: false,
      })
      .promise;

    const text = await extractTextFromPdf(pdf);
    const parsed = parseBloodSugar(text);

    const docRef = db.collection("bloodSugarReports").doc();
    await docRef.set({
      userId: req.body.userId || null,
      ...parsed,
      rawText: text,
      uploadedAt: new Date().toISOString(),
      fileName: req.file.originalname || "uploaded.pdf",
    });

    return res.status(200).json({ message: "OK", data: parsed, docId: docRef.id });
  } catch (err) {
    console.error("BS error:", err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};

export const uploadLipidProfilePdf = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "No file uploaded" });

    const pdf = await pdfjsLib
      .getDocument({
        data: new Uint8Array(req.file.buffer),
        disableWorker: true,
        isEvalSupported: false,
      })
      .promise;

    const text = await extractTextFromPdf(pdf);
    const parsed = parseLipidProfile(text);

    const docRef = db.collection("lipidReports").doc();
    await docRef.set({
      userId: req.body.userId || null,
      ...parsed,
      rawText: text,
      uploadedAt: new Date().toISOString(),
      fileName: req.file.originalname || "uploaded.pdf",
    });

    return res.status(200).json({ message: "OK", data: parsed, docId: docRef.id });
  } catch (err) {
    console.error("Lipid error:", err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};

export const uploadFBCPdf = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "No file uploaded" });

    const pdf = await pdfjsLib
      .getDocument({
        data: new Uint8Array(req.file.buffer),
        disableWorker: true,
        isEvalSupported: false,
      })
      .promise;

    const text = await extractTextFromPdf(pdf);
    const parsed = parseFBC(text);

    const docRef = db.collection("fbcReports").doc();
    await docRef.set({
      userId: req.body.userId || null,
      ...parsed,
      rawText: text,
      uploadedAt: new Date().toISOString(),
      fileName: req.file.originalname || "uploaded.pdf",
    });

    return res.status(200).json({ message: "OK", data: parsed, docId: docRef.id });
  } catch (err) {
    console.error("FBC error:", err);
    return res.status(500).json({ message: "Server error", error: err?.message });
  }
};

export const addCommentLipid = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;
    const ref = db.collection("lipidReports").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Record not found" });
    await ref.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added." });
  } catch (err) {
    console.error("Comment lipid error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const addCommentBS = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;
    const ref = db.collection("bloodSugarReports").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Record not found" });
    await ref.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added." });
  } catch (err) {
    console.error("Comment BS error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const addCommentFBC = async (req, res) => {
  try {
    const { docId } = req.params;
    const { comment } = req.body;
    const ref = db.collection("fbcReports").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Record not found" });
    await ref.update({ doctorComment: comment, commented: true });
    return res.status(200).json({ message: "Comment added." });
  } catch (err) {
    console.error("Comment FBC error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
