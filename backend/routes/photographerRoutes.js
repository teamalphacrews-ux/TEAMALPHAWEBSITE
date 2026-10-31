const express = require('express');
const { getPhotographers, createPhotographer, deletePhotographer, updatePhotographer, getPhotographerWorks } = require('../controllers/photographerController');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/', getPhotographers);
router.post('/', createPhotographer);
router.delete('/:id', deletePhotographer);
router.patch('/:id', updatePhotographer);
router.get('/:name/works', getPhotographerWorks);

module.exports = router;
