import multer from "multer";

export const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) return cb(null, true);
    const err = new Error("File type not allowed");
    err.code = "INVALID_FILE_TYPE";
    cb(err);
  },
});
// Wrap multer's single-file handler so filter/size errors return a clean 400
// instead of bubbling up as a generic 500.
export function uploadSingleFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 10MB)."
        : err.code === "INVALID_FILE_TYPE"
          ? "File type not allowed."
          : "File upload failed.";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}
