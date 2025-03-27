import express from "express";
import {
  addFeedback,
  convertPoints,
  convertReferredPoints,
  DailyClaim,
  forgotPasswordOTP,
  getallusers,
  getReferredUserData,
  investment,
  Login,
  Logout,
  Myprofile,
  resetPassword,
  Signup,
  updatePass,
  uploadPaymentImage,
  verifyOTP,
  verifyUser,
} from "../Controller/UserController.js";
import upload from "../MiddleWare/multerConfig.js";
import { isUserLoggedIn } from "../Utils/Auth.js";

const Router = express.Router();

Router.post("/signup", Signup);
Router.post("/verify-user", verifyUser);
Router.post("/login", Login);
Router.post("/logout", isUserLoggedIn, Logout);
Router.get("/profile", isUserLoggedIn, Myprofile);
Router.put("/updatePass", isUserLoggedIn, updatePass);
Router.get("/points", isUserLoggedIn, DailyClaim);
Router.get("/getRef", isUserLoggedIn, getReferredUserData);
Router.post("/feedBack", isUserLoggedIn, addFeedback);
Router.post("/investment", isUserLoggedIn, investment);
Router.put("/convert-points/:id", isUserLoggedIn, convertPoints);
Router.put("/refConvert-points/:id", isUserLoggedIn, convertReferredPoints);
Router.get("/users", isUserLoggedIn, getallusers);

Router.post("/paymentImage",isUserLoggedIn ,upload.single("paymentImage"), uploadPaymentImage);

Router.post("/forgot-password-otp",forgotPasswordOTP);
Router.post("/verify-otp",verifyOTP);
Router.put("/reset-password",resetPassword);

export default Router;