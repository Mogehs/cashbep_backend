import dotenv from 'dotenv';
dotenv.config();
import Errorhandler from './ErrorHandler.js';
import UserModel from '../Model/UserModel.js';
import jwt from 'jsonwebtoken';

export const isUserLoggedIn = async (req, res, next) => {
  // 1. Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  console.log("Auth token....",token);

  // 2. Check token existence
  if (!token) {
    return next(new Errorhandler("Authentication required. Please login to access this resource.", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !decoded.iat) {
      return next(new Errorhandler("Malformed authentication token", 401));
    }

    const user = await UserModel.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return next(new Errorhandler("The user belonging to this token no longer exists", 401));
    }

    if (user.passwordChangedAfter(decoded.iat)) {
      return next(new Errorhandler("Password was changed recently. Please login again.", 401));
    }

    if (user.status !== 'verified') {
      return next(new Errorhandler("Account not verified. Please verify your account.", 403));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Errorhandler("Your session has expired. Please login again.", 401));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new Errorhandler("Invalid authentication token", 401));
    }
        return next(new Errorhandler("Authentication failed. Please login again.", 401));
  }
};