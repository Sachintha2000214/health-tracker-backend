import { Router } from "express";
import { getPdfs, getPatient, loginPatients, signupPatient, postBloodPressureData, uploadBloodPreessure, uploadBloodSugarPdf, postBloodSugarData, uploadLipidProfilePdf, postLipidProfileData, uploadFBCPdf, postFBCData } from "../controllers/patientController.js";
import multer from "multer";
const patientRouter = Router();

const upload = multer({ storage: multer.memoryStorage() }); // ✅ Configure Multer globally
patientRouter.post("/bloodpressure", postBloodPressureData);
patientRouter.post("/bloodsugar", postBloodSugarData);
patientRouter.post("/lipidprofile", postLipidProfileData);
patientRouter.post("/fbc", postFBCData);
patientRouter.post("/upload/bloodpressure", upload.single('file'), uploadBloodPreessure);
patientRouter.post("/upload/bloodsugar", upload.single('file'), uploadBloodSugarPdf);
patientRouter.post("/upload/lipidprofile", upload.single('file'), uploadLipidProfilePdf);
patientRouter.post("/upload/fbc", upload.single('file'), uploadFBCPdf);
patientRouter.get("/files/bloodpressure", getPdfs);
patientRouter.get('/:id', getPatient);
patientRouter.post('/login', loginPatients);
patientRouter.post('/signup', signupPatient);

export default patientRouter;
