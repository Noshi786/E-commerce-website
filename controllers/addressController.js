import mongoose from 'mongoose';

const ADDRESS_FIELDS = ['street', 'city', 'state', 'postalCode', 'country'];

const validateAddress = (body, { partial = false } = {}) => {
  for (const field of ADDRESS_FIELDS) {
    if (!partial || body[field] !== undefined) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        return `${field} must be a non-empty string`;
      }
    }
  }

  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') {
    return 'isDefault must be a boolean';
  }

  return null;
};

export const getAddresses = (req, res) => res.json(req.user.addresses);

export const addAddress = async (req, res, next) => {
  try {
    const validationError = validateAddress(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const addressData = Object.fromEntries(
      ADDRESS_FIELDS.map((field) => [field, req.body[field].trim()]),
    );
    const makeDefault =
      req.body.isDefault === true || req.user.addresses.length === 0;

    if (makeDefault) {
      req.user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    req.user.addresses.push({
      ...addressData,
      isDefault: makeDefault,
    });
    await req.user.save();

    return res.status(201).json(req.user.addresses);
  } catch (error) {
    return next(error);
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.addressId)) {
      return res.status(400).json({ message: 'Invalid address ID' });
    }

    const validationError = validateAddress(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const address = req.user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    for (const field of ADDRESS_FIELDS) {
      if (req.body[field] !== undefined) {
        address[field] = req.body[field].trim();
      }
    }

    if (req.body.isDefault === true) {
      req.user.addresses.forEach((item) => {
        item.isDefault = item._id.equals(address._id);
      });
    } else if (req.body.isDefault === false) {
      address.isDefault = false;
    }

    await req.user.save();
    return res.json(req.user.addresses);
  } catch (error) {
    return next(error);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.addressId)) {
      return res.status(400).json({ message: 'Invalid address ID' });
    }

    const address = req.user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    if (wasDefault && req.user.addresses.length > 0) {
      req.user.addresses[0].isDefault = true;
    }

    await req.user.save();
    return res.json(req.user.addresses);
  } catch (error) {
    return next(error);
  }
};
