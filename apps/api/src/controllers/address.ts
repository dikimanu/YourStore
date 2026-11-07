import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  CreateAddressInput,
  UpdateAddressInput,
  AddressParams,
} from "@yourstore/shared";
import { User, IAddress } from "../models/User.js";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";

const MAX_ADDRESSES = 5;

/**
 * Formats a subdocument address to a response object with id string.
 */
function formatAddress(addr: IAddress) {
  return {
    id: addr._id ? addr._id.toString() : "",
    label: addr.label,
    name: addr.name,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
  };
}

/**
 * GET /api/v1/addresses
 * List saved addresses for the authenticated user.
 */
export async function listAddresses(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const addresses = (user.addresses || []).map(formatAddress);
  res.status(200).json({ addresses });
}

/**
 * GET /api/v1/addresses/:id
 * Get a specific address for the authenticated user.
 * IDOR check: address MUST belong to req.user.
 */
export async function getAddress(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params as AddressParams;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const address = user.addresses?.find((a) => a._id?.toString() === id);
  if (!address) {
    throw new NotFoundError("Address not found");
  }

  res.status(200).json({ address: formatAddress(address) });
}

/**
 * POST /api/v1/addresses
 * Create a new address for the authenticated user (max 5 addresses).
 */
export async function createAddress(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const input = req.body as CreateAddressInput;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (user.addresses && user.addresses.length >= MAX_ADDRESSES) {
    throw new BadRequestError(`Cannot save more than ${MAX_ADDRESSES} addresses`);
  }

  const newAddress: IAddress = {
    _id: new Types.ObjectId(),
    label: input.label,
    name: input.name,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || "",
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  };

  user.addresses = [...(user.addresses || []), newAddress];
  await user.save();

  res.status(201).json({ address: formatAddress(newAddress) });
}

/**
 * PUT /api/v1/addresses/:id
 * Update an existing address for the authenticated user.
 * IDOR check: ensures address exists on the authenticated user.
 */
export async function updateAddress(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params as AddressParams;
  const input = req.body as UpdateAddressInput;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const address = user.addresses?.find((a) => a._id?.toString() === id);
  if (!address) {
    throw new NotFoundError("Address not found");
  }

  if (input.label !== undefined) address.label = input.label;
  if (input.name !== undefined) address.name = input.name;
  if (input.phone !== undefined) address.phone = input.phone;
  if (input.line1 !== undefined) address.line1 = input.line1;
  if (input.line2 !== undefined) address.line2 = input.line2;
  if (input.city !== undefined) address.city = input.city;
  if (input.state !== undefined) address.state = input.state;
  if (input.pincode !== undefined) address.pincode = input.pincode;

  await user.save();

  res.status(200).json({ address: formatAddress(address) });
}

/**
 * DELETE /api/v1/addresses/:id
 * Delete an address for the authenticated user.
 * IDOR check: ensures address belongs to req.user.
 */
export async function deleteAddress(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }

  const { id } = req.params as AddressParams;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const existingIndex = user.addresses?.findIndex((a) => a._id?.toString() === id);
  if (existingIndex === undefined || existingIndex === -1) {
    throw new NotFoundError("Address not found");
  }

  user.addresses.splice(existingIndex, 1);
  await user.save();

  res.status(200).json({ success: true, message: "Address deleted successfully" });
}
