import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError } from '../utils/ApiError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pms-powerplant-secret-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function sendToken(user, statusCode, res) {
  const token = signToken(user);
  const userData = user.toJSON();
  res.status(statusCode).json({ success: true, token, data: userData });
}

/* Register (first user becomes admin) */
export const register = catchAsync(async (req, res) => {
  const { name, email, password, role, department, phone } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(400, 'Email already registered');

  const userCount = await User.countDocuments();
  const user = await User.create({
    name,
    email,
    password,
    role: userCount === 0 ? 'admin' : (role || 'viewer'),
    department,
    phone,
  });

  sendToken(user, 201, res);
});

/* Login */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is deactivated');

  user.lastLogin = new Date();
  await user.save({ validateModifiedOnly: true });

  sendToken(user, 200, res);
});

/* Get current user profile */
export const getMe = catchAsync(async (req, res) => {
  res.json({ success: true, data: req.user });
});

/* ── Admin: User Management ── */

export const listUsers = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }
  if (req.query.role) filter.role = req.query.role;

  const [data, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, data: user });
});

export const createUser = catchAsync(async (req, res) => {
  const { name, email, password, role, department, phone } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(400, 'Email already registered');

  const user = await User.create({ name, email, password, role, department, phone });
  res.status(201).json({ success: true, data: user });
});

export const updateUser = catchAsync(async (req, res) => {
  const { name, role, department, phone, isActive } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (role !== undefined) update.role = role;
  if (department !== undefined) update.department = department;
  if (phone !== undefined) update.phone = phone;
  if (isActive !== undefined) update.isActive = isActive;

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, data: user });
});

export const deleteUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(204).json();
});

/* Reset password (admin) */
export const resetPassword = catchAsync(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  user.password = password;
  await user.save();
  res.json({ success: true, message: 'Password reset successfully' });
});
