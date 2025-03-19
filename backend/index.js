import express from 'express';
import cors from 'cors';
import { PORT} from './config.js';
import patientRouter from './src/routes/patientRoutes.js';
import doctorRouter from './src/routes/doctorRoutes.js';
const app = express();
const apiRouter = express.Router();
// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
apiRouter.use('/patient', patientRouter);
apiRouter.use('/doctor',doctorRouter);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
