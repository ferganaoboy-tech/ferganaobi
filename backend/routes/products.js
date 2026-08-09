const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { authorizeWithPermission } = require('../middleware/authMiddleware');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFilters,
  getDashboardStats,
  getCompareProducts,
  getReplenishmentRecommendations
} = require('../controllers/productController');

router.get('/stats/dashboard', getDashboardStats);
router.get('/filters', getFilters);
router.get('/compare', getCompareProducts);
router.get('/replenishment', authorizeWithPermission('manage_products'), getReplenishmentRecommendations);

router.route('/')
  .get(getProducts)
  .post(authorizeWithPermission('manage_products'), upload.array('images', 8), createProduct);

router.route('/:id')
  .get(getProduct)
  .put(authorizeWithPermission('manage_products'), upload.array('images', 8), updateProduct)
  .delete(authorizeWithPermission('manage_products'), deleteProduct);

module.exports = router;
