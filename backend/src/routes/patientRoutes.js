import { Router } from "express";
import { getPdfs, getPatient, loginPatients, signupPatient, postBloodPressureData, uploadBloodPreessure, uploadBloodSugarPdf, postBloodSugarData, uploadLipidProfilePdf, postLipidProfileData, uploadFBCPdf, postFBCData, postBmiData, calculateMealCalories, getMealData, calculateDayCalories, getBloodSugarByDoctor, getBloodPressureByDoctor, getFBCByDoctor, getLipidProfileByDoctor, getBloodPressureByPatient, getBloodSugarByPatient, getFBCByPatient, getLipidProfileByPatient, updateDoctorCommentInBloodPressureRecords, updateDoctorCommentInBloodSugarRecords, updateDoctorCommentInLipidRecords, updateDoctorCommentInFBCRecords } from "../controllers/patientController.js";
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
patientRouter.get("/meals",getMealData)
patientRouter.get("/files/bloodpressure", getPdfs);
patientRouter.get('/:id', getPatient);
patientRouter.post('/login', loginPatients);
patientRouter.post('/signup', signupPatient);
patientRouter.post("/bmi", postBmiData);
patientRouter.post("/calories", calculateMealCalories)
patientRouter.post("/daycalories", calculateDayCalories)
patientRouter.get("/getbloodpressurebydoc/:id", getBloodPressureByDoctor)
patientRouter.get("/getbloodsugarbydoc/:id", getBloodSugarByDoctor)
patientRouter.get("/getfbcbydoc/:id", getFBCByDoctor);
patientRouter.get("/getlipidbydoc/:id", getLipidProfileByDoctor);
patientRouter.get("/getbloodpressurebypatient/:id", getBloodPressureByPatient)
patientRouter.get("/getbloodsugarbypatient/:id", getBloodSugarByPatient)
patientRouter.get("/getfbcbypatient/:id", getFBCByPatient);
patientRouter.get("/getlipidbypatient/:id", getLipidProfileByPatient);
patientRouter.put("/updatecomment/:docId", updateDoctorCommentInBloodPressureRecords);
patientRouter.put("/updatebloodsugarcomment/:docId", updateDoctorCommentInBloodSugarRecords);
patientRouter.put("/updatelipidcomment/:docId", updateDoctorCommentInLipidRecords);
patientRouter.put("/updatefbccomment/:docId", updateDoctorCommentInFBCRecords);




export default patientRouter;
