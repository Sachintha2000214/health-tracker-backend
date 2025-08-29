import express from 'express';
import cors from 'cors';
import { createServer } from 'http';      // ✅ needed for socket.io
import { Server } from 'socket.io';       // ✅ socket.io
import { PORT } from './config.js';
import patientRouter from './src/routes/patientRoutes.js';
import doctorRouter from './src/routes/doctorRoutes.js';
import chatRouter from './src/routes/chatRoutes.js';

const app = express();
const server = createServer(app);         // ✅ create HTTP server


const apiRouter = express.Router();

// Middleware
app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);
apiRouter.use('/patient', patientRouter);
apiRouter.use('/doctor', doctorRouter);
apiRouter.use('/chat', chatRouter);

const io = new Server(server, {
  cors: {
    origin: "https://health-tracker-frontend-8f9c-cd0cpvvir.vercel.app", // your frontend URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("sendMessage", (msg) => {
    console.log("New socket message:", msg);
    // Optional: call chatController.sendMessage(msg) here to save
    socket.broadcast.emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

