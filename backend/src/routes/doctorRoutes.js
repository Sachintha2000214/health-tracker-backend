import express from "express";
import { signupDoctor, loginDoctor, getAllDoctors } from "../controllers/doctorController.js";

const doctorRouter = express.Router();

// Route for doctor signup
doctorRouter.post("/signup", signupDoctor);

// Route for doctor login
doctorRouter.post("/login", loginDoctor);
doctorRouter.get("/getalldoctors", getAllDoctors);

export default doctorRouter;
