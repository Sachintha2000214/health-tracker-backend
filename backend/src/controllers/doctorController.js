import { db, auth } from "../config/firebaseConfig.js";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { createUserWithEmailAndPassword } from 'firebase/auth';

const firestore = getFirestore();

export const loginDoctor = async (req, res) => {
    const { email, password } = req.body;
    try {
const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    const doctorRef = db.collection("doctors");
    const docSnapshot = await getDocs(query(doctorRef, where('email', '==', email)));
        if (docSnapshot.empty) {
            return res.status(400).json({ error: "Doctor not found in the database" });
        }
        const doctorData = docSnapshot.docs[0].data();
        res.status(200).json({
            doctor: {
                id: docSnapshot.docs[0].id,
                name: doctorData.name,
                email: doctorData.email,
                doctornumber: doctorData.doctornumber,
                mobilenumber: doctorData.mobilenumber,
            },
            token,
        });
    } catch (error) {
    res.status(400).json({ error: error.message });
    }
};

export const signupDoctor = async (req, res) => {
    const { name, email, doctornumber, mobilenumber, password } = req.body;

    try {
        // Check if the email is already in use
        const existingIdQuery = query(collection(firestore, 'doctors'), where('email', '==', email));
        let idExists = !(await getDocs(existingIdQuery)).empty;
        if (idExists) {
            return res.status(400).json({ error: "Email already exists" });
        }

        // Create a new user in Firebase Authentication
        const userRecord = await createUserWithEmailAndPassword(
            auth,
            email,
            password,
        );

        // Store doctor details in Firestore
        const doctorRef = doc(collection(firestore, 'doctors'));
        await setDoc(doctorRef, {
            name,
            email,
            doctornumber,
            mobilenumber
        });

        res.status(201).json({
            user: userRecord,
            doctor: { name, email, doctornumber, mobilenumber, uid: userRecord.uid },
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

