import UserModel from "../Model/UserModel.js";
import Feedbackmodel from "../Model/Feedbackmodel.js";
import Errorhandler from "../Utils/ErrorHandler.js";
import { catchAsyncError } from "../MiddleWare/CatchAsyncError.js";
import SendMail from "../Utils/SendMail.js";

export const Signup = catchAsyncError(async (req, res, next) => {
  const { name, email, password, referralCode } = req.body;

  let referredByUser = null;

  // Check if user already exists
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    return next(new Errorhandler("Email already registered", 400));
  }

  // Handle referral code validation
  if (referralCode) {
    const [username, , userId] = referralCode.split("/");
    if (!username || !userId) {
      return next(new Errorhandler("Invalid referral code format", 400));
    }

    referredByUser = await UserModel.findOne({ referralLink: referralCode });

    if (!referredByUser) {
      return next(new Errorhandler("Invalid referral code", 400));
    }
  }

  // Create new user (status: "pending")
  const user = await UserModel.create({
    name,
    email,
    password,
    referredBy: referredByUser ? referredByUser._id : null,
    status: "pending",
  });

  // Generate OTP
  const otp = await user.generateOTP();
  const subject = "Verify Your Email - BMX Adventure";
  const text = generateEmailTemplate(name, otp);

  // Send verification email
  await SendMail(email, subject, text);

  res.status(200).json({
    success: true,
    message: "OTP sent to email. Verify your account.",
    user,
  });
});

// Utility function for email template
const generateEmailTemplate = (name, otp) => `
  <p>Hello <strong>${name}</strong>,</p>
  <p>Thank you for signing up! To complete your registration, please verify your email.</p>
  <p>Your OTP for verification is:</p>
  <h3 style="font-size: 32px; font-weight: bold; color: #4CAF50;">${otp}</h3>
  <p>If you did not request this, please ignore this email.</p>
  <p>Best regards,</p>
  <p>The BMX Adventure Team</p>
`;

export const verifyUser = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  // 1. Enhanced input validation
  if (!email?.trim() || !otp?.trim()) {
    return next(new Errorhandler("Email and OTP are required", 400));
  }

  // 2. Find user with necessary fields
  const user = await UserModel.findOne({ email })
    .select('+otp +otpExpires +status +referredBy +password');
  
  if (!user) {
    return next(new Errorhandler("User not found with this email", 404));
  }

  // 3. Check verification status first to avoid unnecessary OTP verification
  if (user.status === "verified") {
    return next(new Errorhandler("User is already verified", 400));
  }

  // 4. Verify OTP with additional checks
  if (!user.otp || !user.otpExpires) {
    return next(new Errorhandler("No active OTP found", 400));
  }

  if (user.otpExpires < Date.now()) {
    return next(new Errorhandler("OTP has expired", 400));
  }

  if (user.otp !== otp) {
    return next(new Errorhandler("Invalid OTP", 400));
  }

  // 5. Update user status and clear OTP
  user.status = "verified";
  user.otp = undefined;
  user.otpExpires = undefined;

  // 6. Process referral if exists
  if (user.referredBy) {
    await UserModel.findByIdAndUpdate(
      user.referredBy,
      {
        $push: {
          referredPoints: {
            userId: user._id,
            points: 1000,
            date: new Date()
          }
        }
      },
      { new: true }
    );
  }

  const token = user.getJWTToken();

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
  };

  res.status(200).json({
    success: true,
    message: "Account verified successfully",
    token,
    user: userData, 
  });
});


export const forgotPasswordOTP = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new Errorhandler("Email is required.", 400));
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(new Errorhandler("User not found with this email.", 404));
  }

  const otp = await user.generateOTP();
  console.log("otp is .....", otp);

  const name = user.name;
  const subject = "OTP for Password Reset";
  const text = `
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset your password for your account. To proceed, please use the OTP below:</p>
    <h3 style="font-size: 32px; font-weight: bold; color: #4CAF50;">${otp}</h3>
    <p>This OTP is valid for a limited time. If you did not request a password reset, please ignore this email or contact our support team immediately.</p>
    <p>Best regards,</p>
    <p>The Car Rental Service Team</p>
  `;

  await SendMail(email, subject, text);

  user.otp = otp;
  await user.save();

  res.status(200).json({ message: "OTP sent successfully!" });
});

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new Errorhandler("Email and OTP are required.", 400));
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(new Errorhandler("User not found with this email.", 404));
  }

  if (user.otp !== otp) {
    return next(new Errorhandler("Invalid or Expired OTP.", 400));
  }

  res.status(200).json({ message: "OTP verified successfully." });
});

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new Errorhandler("Email and Password are required.", 400));
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(new Errorhandler("User not found with this email.", 404));
  }

  if (!user.otp) {
    return next(
      new Errorhandler("OTP not verified. Please verify your OTP first.", 400)
    );
  }

  user.password = password;
  user.otp = undefined;
  await user.save();

  res.status(200).json({ message: "Password reset successfully." });
});

export const getReferredUserData = catchAsyncError(async (req, res, next) => {
  try {
    const { referralCode } = req.query;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const referredByUser = await UserModel.findOne({
      referralLink: referralCode,
    }).populate({
      path: "referredPoints.userId",
      select: "name email UserLevel totalPointsEarned referralLink",
    });

    if (!referredByUser) {
      return res.status(404).json({
        success: false,
        message: "Referred user not found",
      });
    }

    const referredUsersData = [];

    for (let point of referredByUser.referredPoints) {
      if (point.userId) {
        const latestUser = await UserModel.findById(point.userId).select(
          "name email UserLevel totalPointsEarned referralLink"
        );

        if (latestUser) {
          referredUsersData.push({
            name: latestUser.name,
            email: latestUser.email,
            UserLevel: latestUser.UserLevel,
            totalPointsEarned: latestUser.totalPointsEarned,
            referralLink: latestUser.referralLink,
          });
        }
      }
    }

    if (referredUsersData.length > 0) {
      return res.status(200).json({
        success: true,
        referredUsers: referredUsersData,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No referred users found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export const Login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Input validation
  if (!email || !password) {
    return next(new Errorhandler("Please provide email and password", 400));
  }

  // 2. Find user with password field
  const user = await UserModel.findOne({ email }).select("+password +status +loginAttempts +lockUntil");
  
  // 3. Check if account is locked
  if (user?.lockUntil && user.lockUntil > Date.now()) {
    const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000);
    return next(new Errorhandler(
      `Account temporarily locked. Try again in ${retryAfter} seconds`, 
      423 // Locked status code
    ));
  }

  // 4. Verify user exists
  if (!user) {
    return next(new Errorhandler("Invalid Email or Password", 401));
  }

  // 5. Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    // Increment failed attempts
    user.loginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minute lock
      await user.save();
      
      return next(new Errorhandler(
        "Too many failed attempts. Account locked for 30 minutes",
        423
      ));
    }
    
    await user.save();
    return next(new Errorhandler("Invalid Email or Password", 401));
  }

  // 6. Check email verification status
  if (user.status === "pending") {
    const otp = await user.generateOTP();
    const subject = "Verify Your Email - BMX Adventure";
    const text = generateEmailTemplate(user.name, otp);
    await SendMail(user.email, subject, text);

    return next(
      new Errorhandler(
        "Account not verified. A new OTP has been sent to your email.",
        403
      )
    );
  }

  // 7. Successful login - generate token
  const token = user.getJWTToken();
  console.log("Login token....",token);

  // 8. Reset login attempts and lock status
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  // 9. Set secure HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // 10. Remove sensitive data
  user.password = undefined;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.loginAttempts = undefined;
  user.lockUntil = undefined;

  res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user,
  });
});

export const Logout = catchAsyncError(async (req, res, next) => {
  res.cookie("token", null, {
    httpOnly: true,
    expires: new Date(Date.now()),
  });

  res.status(200).json({
    success: true,
    message: "User Logged Out Successfully",
  });
});

export const getallusers = catchAsyncError(async (req, res, next) => {
  const users = await UserModel.find();
  res.json({
    success: true,
    count: users.length,
    users,
  });
});

export const Myprofile = catchAsyncError(async (req, res, next) => {
  const user = await req.user;

  if (!user) {
    return next(new Errorhandler("User not logged in", 400));
  }

  res.status(200).json({
    success: true,
    user,
  });
});

export const updatePass = catchAsyncError(async (req, res, next) => {
  const { oldPassword, Password, ConfirmPassword } = req.body;

  if (!oldPassword || !Password || !ConfirmPassword) {
    return next(
      new Errorhandler("Please provide all the required fields", 400)
    );
  }

  let user = await UserModel.findById(req.user._id).select("+password");

  if (!user) {
    return next(new Errorhandler("User not found", 404));
  }

  const isPasswordmatch = await user.comparePassword(oldPassword);

  if (!isPasswordmatch) {
    return next(new Errorhandler("Old password is incorrect", 401));
  }

  if (Password !== ConfirmPassword) {
    return next(new Errorhandler("Passwords do not match", 400));
  }

  user.password = Password;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});

export const DailyClaim = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;

  if (!userId) {
    return next(new Errorhandler("User not logged in", 400));
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    return next(new Errorhandler("User not found", 404));
  }

  if (user.eligible === "false") {
    return null;
  }

  const currentDate = new Date().toISOString().split("T")[0];
  const lastClaimDate = user.dailyPoints?.lastClaimDate
    ? user.dailyPoints.lastClaimDate.toISOString().split("T")[0]
    : null;

  if (lastClaimDate !== currentDate) {
    user.dailyPoints.count = 0;
    user.dailyPoints.lastClaimDate = new Date();
  }

  if (user.dailyPoints.count >= 5) {
    return res.status(400).json({
      success: false,
      message: "Daily claim limit reached. Try again tomorrow.",
    });
  }

  const pointsToAdd = 20;
  user.dailyPoints.count += 1;
  user.dailyPoints.totalPoints += pointsToAdd;
  user.totalPointsEarned += pointsToAdd;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Daily points added successfully",
    dailyClaimCount: user.dailyPoints.count,
    user,
  });
});

export const investment = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const { amount } = req.body;

  if (!userId) {
    return next(new Errorhandler("User not logged in", 400));
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    return next(new Errorhandler("User not found", 404));
  }

  if (!amount || amount < 1000) {
    return next(
      new Errorhandler("Amount is compulsory and must be at least 1000", 400)
    );
  }

  user.eligible = true;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Investment successful. User is now eligible.",
    user,
  });
});

export const addFeedback = catchAsyncError(async (req, res, next) => {
  const { content } = req.body;

  if (!content) {
    return next(new Errorhandler("Feedback content is required", 400));
  }

  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return next(new Errorhandler("User not found", 404));
  }

  const existingFeedback = await Feedbackmodel.findOne({
    userId: req.user._id,
  });

  if (existingFeedback) {
    await Feedbackmodel.findByIdAndDelete(existingFeedback._id);
  }

  const feedback = await Feedbackmodel.create({
    userId: req.user._id,
    content,
  });

  const populatedFeedback = await Feedbackmodel.findById(feedback._id).populate(
    {
      path: "userId",
      select: "name email",
    }
  );

  res.status(201).json({
    success: true,
    message: "Feedback submitted successfully",
    feedback: populatedFeedback,
  });
});

export const convertPoints = catchAsyncError(async (req, res, next) => {
  try {
    const POINTS_TO_PKR_RATE = 4;
    const userId = req.params.id;

    const user = await UserModel.findById(userId);

    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    const totalPoints = user.dailyPoints?.totalPoints;

    if (typeof totalPoints !== "number" || isNaN(totalPoints)) {
      return next(
        new Errorhandler("Invalid totalPoints value for the user", 400)
      );
    }

    const convertedPKR = Math.floor(totalPoints / POINTS_TO_PKR_RATE);

    user.convertedPointsInPKR += convertedPKR;
    user.dailyPoints.totalPoints = 0;
    await user.save();
    res.status(200).json({
      success: true,
      message: "Your Bep coins have been successfully exchanged.",
      data: {
        totalPoints: user.dailyPoints.totalPoints,
        convertedPointsInPKR: user.convertedPointsInPKR,
      },
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export const convertReferredPoints = catchAsyncError(async (req, res, next) => {
  try {
    const POINTS_TO_PKR_RATE = 4;
    const userId = req.params.id;

    const user = await UserModel.findById(userId);

    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    if (
      !Array.isArray(user.referredPoints) ||
      user.referredPoints.length === 0
    ) {
      return next(
        new Errorhandler("No referred points found for the user", 400)
      );
    }

    const totalReferredPoints = user.referredPoints.reduce(
      (acc, ref) => acc + (ref.points || 0),
      0
    );

    if (typeof totalReferredPoints !== "number" || isNaN(totalReferredPoints)) {
      return next(
        new Errorhandler("Invalid points value in referredPoints array", 400)
      );
    }

    const convertedPKR = Math.floor(totalReferredPoints / POINTS_TO_PKR_RATE);

    user.referredPoints = user.referredPoints.map((ref) => ({
      ...ref,
      points: 0,
    }));

    user.convertedPointsInPKR = (user.convertedPointsInPKR || 0) + convertedPKR;

    await user.save();

    res.status(200).json({
      success: true,
      message:
        "The coins from your referral link have been successfully exchanged.",
      data: {
        totalReferredPoints,
        convertedPointsInPKR: user.convertedPointsInPKR,
      },
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export const uploadPaymentImage = catchAsyncError(async (req, res, next) => {
console.log("api is running.....")
  if (!req.user) {
    return next(new Errorhandler("Please login first", 401));
  }

  const filePath = req.file?.path;
  console.log("file path .....",filePath)
  if (!filePath) {
    return next(new Errorhandler("File is required", 400));
  }

  req.user.paymentImage = filePath;
  await req.user.save();

  res.status(200).json({ success: true, message: "Uploaded successfully", file: filePath });
});
