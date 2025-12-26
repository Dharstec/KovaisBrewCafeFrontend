module.exports = (res, error, message = "Internal Server Error") => {
  console.error("❌ ERROR:", error);

  return res.status(500).json({
    success: false,
    message,
    error: error.message
  });
};
