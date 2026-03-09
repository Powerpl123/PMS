import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.js';
import {
  register, login, getMe,
  listUsers, getUser, createUser, updateUser, deleteUser, resetPassword,
} from '../controllers/authController.js';

const r = Router();

/* Public */
r.post('/register', register);
r.post('/login', login);

/* Authenticated */
r.get('/me', protect, getMe);

/* Admin-only: User Management */
r.get('/users', protect, restrictTo('admin', 'manager'), listUsers);
r.get('/users/:id', protect, restrictTo('admin', 'manager'), getUser);
r.post('/users', protect, restrictTo('admin'), createUser);
r.put('/users/:id', protect, restrictTo('admin'), updateUser);
r.delete('/users/:id', protect, restrictTo('admin'), deleteUser);
r.post('/users/:id/reset-password', protect, restrictTo('admin'), resetPassword);

export default r;
