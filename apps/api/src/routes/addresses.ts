import { Router } from "express";
import {
  CreateAddressInputSchema,
  UpdateAddressInputSchema,
  AddressParamsSchema,
} from "@yourstore/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/address.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// All address routes require an authenticated user
router.use(authenticate);

router.get("/", asyncHandler(listAddresses));
router.get("/:id", validateParams(AddressParamsSchema), asyncHandler(getAddress));
router.post("/", validateBody(CreateAddressInputSchema), asyncHandler(createAddress));
router.put(
  "/:id",
  validateParams(AddressParamsSchema),
  validateBody(UpdateAddressInputSchema),
  asyncHandler(updateAddress),
);
router.delete("/:id", validateParams(AddressParamsSchema), asyncHandler(deleteAddress));

export default router;
