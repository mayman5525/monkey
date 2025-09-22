require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const logger = require("./utils/logger");
const nodemon = require("nodemon");
const initDb = require("./utils/initDB");

const app = express();
const PORT = process.env.PORT || 3000;

const formRoutes = require("./router/form");
const userRoutes = require("./router/users");
// Security middleware
app.use(helmet());
app.use(cors({ origin: "*" }));

// function middleware(req, res, next) {
//   console.log("middleware called");
//   next();
// }
// function standardExpressCallBck(req, res, next) {
//   res.send("hello world from the standard callback");
// }
// function middleware2() {
//   console.log("middleware2 called");
// }
// app.get("/", middleware, middleware2, standardExpressCallBck);
// app.get("/test",middleware,standardExpressCallBck)
// Logging middleware
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/forms", formRoutes);
app.use("/api/user", userRoutes);
app.use("/api/products", require("./router/products"));
app.use("/api/extras", require("./router/extras"));
app.use("/api/orders", require("./router/order"));
// app.use("/api/categories", require("./router/category"));
// app.use("/api/orders", require("./router/order"));

// // 404 handler
// app.all('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found'
//   });
// });

// /api/user/signup
// /api/user/login
// /api/user/reset-password
// /api/user/request-reset-code
// /api/user/reset-password-with-code

// Global error handler
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

(async () => {
  await initDb();
  app.listen(PORT, () => {
    logger.info(` Server running on port ${PORT}`);
  });
})();

module.exports = app;
