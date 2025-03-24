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
  verifyOTP,
  verifyUser,
} from "../Controller/UserController.js";
import { isUserLoggedin } from "../Utils/Auth.js";

const Router = express.Router();

Router.post("/signup", Signup);
Router.post("/verify-user", verifyUser);
Router.post("/login", Login);
Router.post("/logout", isUserLoggedin, Logout);
Router.get("/profile", isUserLoggedin, Myprofile);
Router.put("/updatePass", isUserLoggedin, updatePass);
Router.get("/points", isUserLoggedin, DailyClaim);
Router.get("/getRef", isUserLoggedin, getReferredUserData);
Router.post("/feedBack", isUserLoggedin, addFeedback);
Router.post("/investment", isUserLoggedin, investment);
Router.put("/convert-points/:id", isUserLoggedin, convertPoints);
Router.put("/refConvert-points/:id", isUserLoggedin, convertReferredPoints);
Router.get("/users", isUserLoggedin, getallusers);

Router.post("/forgot-password-otp",forgotPasswordOTP);
Router.post("/verify-otp",verifyOTP);
Router.put("/reset-password",resetPassword);

export default Router;