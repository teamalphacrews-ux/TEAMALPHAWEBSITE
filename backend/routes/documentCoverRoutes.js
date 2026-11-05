const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const MAX_BYTES = 8 * 1024 * 1024;
const mimeTypes = ["image/jpeg", "image/png", "image/webp"];
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function validateCover(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length)
    throw fail("Choose a JPEG, PNG or WebP image.");
  const data = file.buffer;
  if (data.length > MAX_BYTES)
    throw fail("Cover images must be no larger than 8 MB.", 413);
  if (!mimeTypes.includes(file.mimetype))
    throw fail("Use a JPEG, PNG or WebP image.");
  const png =
    data.length >= 33 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR";
  const jpeg =
    data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255;
  const webp =
    data.length >= 20 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16)) &&
    data.readUInt32LE(4) === data.length - 8;
  if (
    !(file.mimetype === "image/png"
      ? png
      : file.mimetype === "image/jpeg"
        ? jpeg
        : webp)
  )
    throw fail(
      "The image content does not match its JPEG, PNG or WebP file type.",
    );
  if (png) {
    const width = data.readUInt32BE(16),
      height = data.readUInt32BE(20);
    if (!width || !height || width * height > 80000000)
      throw fail("Use a cover image with no more than 80 megapixels.");
  }
  return file;
}
function cloudinaryReady(env = process.env) {
  return !!(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  );
}
async function uploadCover(file, options = {}) {
  validateCover(file);
  const env = options.env || process.env;
  const client = options.client || cloudinary;
  if (!cloudinaryReady(env))
    throw fail(
      "Image uploads are not configured. Configure Cloudinary before adding a cover photo.",
      503,
    );
  client.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: "teamalpha/document-covers",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        overwrite: false,
        unique_filename: true,
        use_filename: false,
        transformation: [{ width: 2400, height: 1600, crop: "limit" }],
      },
      (error, result) => {
        if (error || !result?.secure_url)
          return reject(
            fail("The cover image could not be uploaded. Please retry.", 502),
          );
        try {
          const url = new URL(result.secure_url);
          if (url.protocol !== "https:" || url.username || url.password)
            throw Error("Invalid image URL");
          resolve({
            url: url.href,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        } catch {
          reject(
            fail("The image service did not return a secure cover URL.", 502),
          );
        }
      },
    );
    stream.on?.("error", () =>
      reject(
        fail("The cover image upload was interrupted. Please retry.", 502),
      ),
    );
    stream.end(file.buffer);
  });
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, done) =>
    done(
      mimeTypes.includes(file.mimetype)
        ? null
        : fail("Use a JPEG, PNG or WebP image."),
      mimeTypes.includes(file.mimetype),
    ),
}).single("image");
const router = express.Router();
router.post("/document-covers", auth, requireAdmin, (req, res) => {
  if (!cloudinaryReady())
    return res
      .status(503)
      .json({
        error:
          "Image uploads are not configured. Configure Cloudinary before adding a cover photo.",
      });
  upload(req, res, async (error) => {
    if (error)
      return res
        .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
        .json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "Cover images must be no larger than 8 MB."
              : error.status
                ? error.message
                : "Upload one image using the image field.",
        });
    try {
      res.status(201).json(await uploadCover(req.file));
    } catch (failure) {
      res
        .status(failure.status || 502)
        .json({
          error: failure.status
            ? failure.message
            : "The cover image could not be uploaded. Please retry.",
        });
    }
  });
});
module.exports = router;
module.exports.validateCover = validateCover;
module.exports.uploadCover = uploadCover;
module.exports.cloudinaryReady = cloudinaryReady;
