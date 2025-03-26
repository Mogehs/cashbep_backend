import dotenv from 'dotenv';
dotenv.config();
import Errorhandler from './ErrorHandler.js';
import UserModel from '../Model/UserModel.js';
import jwt from 'jsonwebtoken';

export const isUserLoggedin = async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new Errorhandler("Please login to access this page.", 401));
  }

  try {
    const Decode = jwt.verify(token, process.env.JwT_Secret);

    const user = await UserModel.findById(Decode.id);
    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new Errorhandler("Invalid token, please login again", 401));
  }
};

