import jwt from 'jsonwebtoken';

export const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured before issuing or verifying tokens');
  }
  return process.env.JWT_SECRET;
};

export const generateToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
