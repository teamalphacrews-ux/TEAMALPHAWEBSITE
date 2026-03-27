const express = require('express');
const { getPhotographers, createPhotographer, deletePhotographer, updatePhotographer, getPhotographerWorks } = require('../controllers/photographerController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getPhotographers);
router.post('/', auth, createPhotographer);
router.delete('/:id', auth, deletePhotographer);
router.patch('/:id', auth, updatePhotographer);
router.get('/:name/works', auth, getPhotographerWorks);

module.exports = router;
