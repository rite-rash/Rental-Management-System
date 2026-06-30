
import express from 'express';

import * as tenantController from '../controllers/tenantController';

const router = express.Router();

router.get('/', tenantController.getAllTenant);
router.post('/', tenantController.createTenant);
router.get('/:id', tenantController.updateTenant);
router.put('/:id', tenantController.deleteTenant);

export default router;