const { errorResponse, successResponse, validationErrorResponse } = require("../utils/ErrorHandling");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const { createUser, getUser } = require("../queries/userQueries");

const signEmail = async (id) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "15m",
  });
  return token;
};

exports.signup = catchAsync(async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if ( !name || !email || !password ) {
      return errorResponse(res, "All fields are required", 401);
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    req.body.password=hashedPassword;
    const data = await createUser(req.body);
    if (!data || !data.length) {
    return errorResponse(res, "Unable to create user", 500);
    }
    successResponse(res, "Account created successfully!", 201, data[0]);
  } catch (error) {
    // Handle Prisma error codes
    if (error.code === "P2010" && error.meta?.code === "23505") {
      return errorResponse(res, "Email already exists", 400);
    }
    // Handle missing required field (NOT NULL constraint violation)
    if (error.code === "P2010" && error.meta?.code === "23502") {
      return errorResponse(res, "Missing required field", 400);
    }
    // Handle bad data type or invalid input
    if (error.code === "P2010" && error.meta?.code === "22P02") {
      return errorResponse(res, "Invalid input data", 400);
    }
    console.log("Signup error:", error);
    return errorResponse(res, error.message || "Internal Server Error", 500);
  }
});

exports.login = catchAsync(async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(res, "All fields are required", 400);
    }
    const user = await getUser({ email });
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, "Invalid credentials", 401);
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );
    return successResponse(res, "Login successful", 200, {
      email: user.email,
      token: token,
    });
  } catch (error) {
    console.log("Login error:", error);
    return errorResponse(res, error.message || "Internal Server Error", 500);
  }
});