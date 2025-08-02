const Company = require("../models/Company");

exports.registerCompany = async (req, res) => {
  const company = await Company.create({ name: req.body.name });
  res.json(company);
};

exports.uploadFiles = async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  const company = await Company.findByIdAndUpdate(id, {
    "files.nodes": files.nodes[0].path,
    "files.edges": files.edges[0].path,
    "files.demand": files.demand[0].path,
    status: "pending"
  }, { new: true });

  res.json(company);
};

exports.getPendingCompanies = async (req, res) => {
  const companies = await Company.find({ status: "pending" });
  res.json(companies);
};

exports.uploadModel = async (req, res) => {
  const { id } = req.params;
  const fs = require("fs");

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Model file is missing" });
    }

    const file = req.file;
    const modelPath = `models/${id}_gcn.pth`;

    // Ensure models folder exists
    if (!fs.existsSync("models")) {
      fs.mkdirSync("models");
    }

    fs.renameSync(file.path, modelPath);

    const company = await Company.findByIdAndUpdate(
      id,
      {
        "files.model": modelPath,
        status: "completed"
      },
      { new: true }
    );

    res.json({ message: "✅ Model uploaded successfully", company });
  } catch (err) {
    console.error("❌ Error uploading model:", err.message);
    res.status(500).json({ error: "Internal server error during model upload" });
  }
};
