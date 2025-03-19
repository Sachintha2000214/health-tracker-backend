import express from "express";
import { signupDoctor, loginDoctor } from "../controllers/doctorController.js";

const doctorRouter = express.Router();

// Route for doctor signup
doctorRouter.post("/signup", signupDoctor);

// Route for doctor login
doctorRouter.post("/login", loginDoctor);

export default doctorRouter;
