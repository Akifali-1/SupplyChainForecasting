const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const companyRoutes = require("./routes/CompanyRoutes");
const dataRoutes = require("./routes/dataRotes");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use("/models", express.static("models"));

app.use("/api/company", companyRoutes);
app.use("/api/data", dataRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

app.listen(5000, () => console.log("Backend running on port 5000"));
