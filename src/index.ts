import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import productRoutes from './api/v1/routes/productRoutes';
import authRoutes from './api/v1/routes/authRoutes';
import consoleRoutes from './api/v1/routes/consoleRoutes';
import sessionRoutes from './api/v1/routes/sessionRoutes';
import checkoutRoutes from './api/v1/routes/checkoutRoutes';
import reportRoutes from './api/v1/routes/reportRoutes';
import historyRoutes from './api/v1/routes/historyRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;



app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(helmet()); // Set common security headers
app.use(express.json()); // Parse incoming JSON requests

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/consoles', consoleRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/history', historyRoutes);
// Core Middleware


// Simple health check route
app.get('/', (req: Request, res: Response) => {
  res.send('GameZone POS API is running!');
});


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});

