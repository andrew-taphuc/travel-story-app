require("dotenv").config();

const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const upload = require("./multer");
const fs = require("fs");
const path = require("path");

const { authenticateToken } = require("./utilities");

const User = require("./models/user.model");
const TravelStory = require("./models/travelStory.model");

mongoose.connect(config.connectionString);

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Create Account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  const isUser = await User.findOne({ email });
  if (isUser) {
    return res
      .status(400)
      .json({ error: true, message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    fullName,
    email,
    password: hashedPassword,
  });

  await user.save();

  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "72h",
    }
  );

  return res.status(201).json({
    error: false,
    user: { fullName: user.fullName, email: user.email },
    accessToken,
    message: "Registration Successful",
  });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }

  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "72h",
    }
  );

  return res.json({
    error: false,
    message: "Login Successful",
    user: { fullName: user.fullName, email: user.email },
    accessToken,
  });
});

// Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { userId } = req.user;

  const isUser = await User.findOne({ _id: userId });

  if (!isUser) {
    return res.sendStatus(401);
  }

  return res.json({
    user: isUser,
    message: "",
  });
});

// Route to handle image upload
app.post("/image-upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: true, message: "No image uploaded" });
    }

    const imageUrl = `http://localhost:8000/uploads/${req.file.filename}`;

    res.status(200).json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Delete an image from uploads folder
app.delete("/delete-image", async (req, res) => {
  const { imageUrl } = req.query;

  if (!imageUrl) {
    return res
      .status(400)
      .json({ error: true, message: "imageUrl parameter is required" });
  }

  try {
    // Extract the filename from the imageUrl
    const filename = path.basename(imageUrl);

    // Define the file path
    const filePath = path.join(__dirname, "uploads", filename);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Delete the file from the uploads folder
      fs.unlinkSync(filePath);
      res.status(200).json({ message: "Image deleted successfully" });
    } else {
      res.status(200).json({ error: true, message: "Image not found" });
    }
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Serve static files from the uploads and assets directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Add Travel Story
app.post("/add-travel-story", authenticateToken, async (req, res) => {
  const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
  const { userId } = req.user;

  // Validate required fields
  if (!title || !story || !visitedLocation || !imageUrl || !visitedDate) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  // Convert visitedDate from milliseconds to Date object
  const parsedVisitedDate = new Date(parseInt(visitedDate));

  try {
    const travelStory = new TravelStory({
      title,
      story,
      visitedLocation,
      userId,
      imageUrl,
      visitedDate: parsedVisitedDate,
    });

    await travelStory.save();
    res.status(201).json({ story: travelStory, message: "Added Successfully" });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// Get All Travel Stories
app.get("/get-all-stories", authenticateToken, async (req, res) => {
  const { userId } = req.user;

  try {
    const travelStories = await TravelStory.find({ userId: userId }).sort({
      isFavourite: -1,
    });
    res.status(200).json({ stories: travelStories });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Edit Travel Story
app.put("/edit-story/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
  const { userId } = req.user;

  // Validate required fields
  if (!title || !story || !visitedLocation || !visitedDate) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  // Convert visitedDate from milliseconds to Date object
  const parsedVisitedDate = new Date(parseInt(visitedDate));

  try {
    // Find the travel story by ID and ensure it belongs to the authenticated user
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });

    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel story not found" });
    }

    const placeholderImgUrl = `http://localhost:8000/assets/placeholder.png`;

    travelStory.title = title;
    travelStory.story = story;
    travelStory.visitedLocation = visitedLocation;
    travelStory.imageUrl = imageUrl || placeholderImgUrl;
    travelStory.visitedDate = parsedVisitedDate;

    await travelStory.save();
    res.status(200).json({ story: travelStory, message: "Update Successful" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Delete a travel story
app.delete("/delete-story/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  try {
    // Find the travel story by ID and ensure it belongs to the authenticated user
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });

    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel story not found" });
    }

    // Delete the travel story from the database
    await travelStory.deleteOne({ _id: id, userId: userId });

    // Extract the filename from the imageUrl
    const imageUrl = travelStory.imageUrl;
    const filename = path.basename(imageUrl);

    // Define the file path
    const filePath = path.join(__dirname, "uploads", filename);

    // Delete the image file from the uploads folder
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Failed to delete image file:", err);
        // Optionally, you could still respond with a success status here
        // if you don't want to treat this as a critical error.
      }
    });

    res.status(200).json({ message: "Travel story deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Update isFavourite
app.put("/update-is-favourite/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isFavourite } = req.body;
  const { userId } = req.user;

  try {
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });

    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel story not found" });
    }

    travelStory.isFavourite = isFavourite;

    await travelStory.save();
    res.status(200).json({ story: travelStory, message: "Update Successful" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Search travel stories
app.get("/search", authenticateToken, async (req, res) => {
  const { query } = req.query;
  const { userId } = req.user;

  if (!query) {
    return res.status(404).json({ error: true, message: "query is required" });
  }

  try {
    const searchResults = await TravelStory.find({
      userId: userId,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { story: { $regex: query, $options: "i" } },
        { visitedLocation: { $regex: query, $options: "i" } },
      ],
    }).sort({ isFavourite: -1 });

    res.status(200).json({ stories: searchResults });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// Filter travel stories by date range
app.get("/travel-stories/filter", authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  const { userId } = req.user;

  try {
    // Convert startDate and endDate from milliseconds to Date objects
    const start = new Date(parseInt(startDate));
    const end = new Date(parseInt(endDate));

    // Find travel stories that belong to the authenticated user and fall within the date range
    const filteredStories = await TravelStory.find({
      userId: userId,
      visitedDate: { $gte: start, $lte: end },
    }).sort({ isFavourite: -1 });

    res.status(200).json({stories: filteredStories});
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

app.listen(8000);
module.exports = app;
