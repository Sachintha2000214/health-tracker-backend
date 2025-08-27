import { db} from "../config/firebaseConfig.js";
// Send message
export const sendMessage = async (req, res) => {
  try {
    const { senderId, senderType, receiverId, receiverType, message } = req.body;

    if (!senderId || !receiverId || !message) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const newMessage = {
      senderId,
      senderType,      // "doctor" or "patient"
      receiverId,
      receiverType,    // "doctor" or "patient"
      message,
      timestamp: Date.now(),
      status: "sent"
    };

    await db.collection("messages").add(newMessage);

    res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get messages between two users
export const getMessages = async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;

    if (!doctorId || !patientId) {
      return res.status(400).json({ success: false, error: "Missing doctorId or patientId" });
    }

    const sentMessages = await db.collection("messages")
      .where("senderId", "==", doctorId)
      .where("receiverId", "==", patientId)
      .get();

    const receivedMessages = await db.collection("messages")
      .where("senderId", "==", patientId)
      .where("receiverId", "==", doctorId)
      .get();

    const messages = [
      ...sentMessages.docs.map(doc => doc.data()),
      ...receivedMessages.docs.map(doc => doc.data())
    ].sort((a, b) => a.timestamp - b.timestamp);

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
