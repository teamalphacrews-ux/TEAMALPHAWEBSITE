const router = require('express').Router();
const multer = require('multer');
const Image = require('../models/StudioProfileImage');
const { validateCover } = require('./documentCoverRoutes');
const maxBytes = 2 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 2 } }).single('image');

// Studio profile images are public brand assets; business settings and originals remain private.
router.get('/profile-images/:id', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.sendStatus(404);
  try {
    const image = await Image.findById(req.params.id).select('+data');
    if (!image) return res.sendStatus(404);
    res.set({ 'Content-Type': image.mimeType, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=86400, immutable' });
    res.send(image.data);
  } catch { res.sendStatus(503); }
});
router.post('/profile-images', require('../middleware/auth'), require('../middleware/requireAdmin'), (req, res) => {
  upload(req, res, async error => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Choose an image no larger than 2 MB.' : 'Upload one JPEG, PNG or WebP image.' });
    try {
      validateCover(req.file);
      const image = await Image.create({ mimeType: req.file.mimetype, data: req.file.buffer, uploadedBy: req.user.id });
      res.status(201).json({ url: '/api/studio/profile-images/' + image._id });
    } catch (failure) { res.status(failure.status || 503).json({ error: failure.status ? failure.message : 'Your studio photo could not be saved.' }); }
  });
});
module.exports = router;
