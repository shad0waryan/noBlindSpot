import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { APP_CONFIG } from "./config/appConfig.js";
import authRoutes from "./routes/auth.js";
import mapRoutes from "./routes/maps.js";
import errorHandler from "./middleware/errorHandler.js";

dotenv.config({ path: "./.env" });
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: APP_CONFIG.name,
    version: APP_CONFIG.version,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/maps", mapRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 ${APP_CONFIG.name} server running on port ${PORT}`);
});
