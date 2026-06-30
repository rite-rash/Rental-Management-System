import express from 'express'; 
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));


//routes


export default app;