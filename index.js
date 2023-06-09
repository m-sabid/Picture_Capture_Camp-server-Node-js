const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json());
dotenv.config();

// Middleware to verify JWT token
const verifyJWT = (req, res, next) => {
  // Get the token from the request headers
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized--1" });
  }
  const token = authorizationHeader.split(" ")[1];

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized--2" });
    }
    // Token is valid, attach the decoded payload to the request object
    req.user = decoded;
    next();
  });
};

// Mongo URL
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// JWT token
app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.send({ token });
});

// Create User API
app.post("/users", async (req, res) => {
  try {
    const { name, email, gender, phoneNumber, address } = req.body;

    // Check if the user with the same email already exists
    const existingUser = await client
      .db("picture_capture_camp_data")
      .collection("users")
      .findOne({ email });

    if (existingUser) {
      // User with the same email already exists
      return res.status(409).json({ error: "User already exists" });
    }

    // Set the default role to "user"
    const role = "user";

    // Save user data to MongoDB with the default role
    const result = await client
      .db("picture_capture_camp_data")
      .collection("users")
      .insertOne({
        name,
        email,
        gender,
        phoneNumber,
        address,
        role, // Include the role in the user data
      });

    if (result.insertedId) {
      // User data saved successfully
      res.json({ success: true });
      console.log("User data saved successfully");
    } else {
      // Failed to save user data
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error saving user data to MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Verify JWT
 */
// Get All Users
app.get("/api/users", verifyJWT, async (req, res) => {
  try {
    if (req.decoded.role !== "admin") {
      // If the user is not an admin, return a 403 Forbidden response
      return res.status(403).json({
        error: "Access denied. Only admin users can access this endpoint.",
      });
    }

    const users = await client
      .db("picture_capture_camp_data")
      .collection("users")
      .find()
      .toArray();

    res.json(users);
  } catch (error) {
    console.error("Error retrieving users from MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/classes", async (req, res) => {
  try {
    // Check if the user's role is "instructor"
    // if (req.decoded.role !== "instructor") {
    //   return res.status(403).json({
    //     error: "Access denied. Only instructor users can access this endpoint.",
    //   });
    // }
    const { title, seats, price, image, instructorName, instructorEmail } =
      req.body;

    // Parse seats and price as numbers
    const parsedSeats = parseInt(seats);
    const parsedPrice = parseFloat(price);

    // Save the new class to MongoDB
    const result = await client
      .db("picture_capture_camp_data")
      .collection("classes")
      .insertOne({
        title,
        seats: parsedSeats,
        price: parsedPrice,
        image,
        instructorEmail,
        instructorName,
        status: "pending",
      });

    if (result.insertedId) {
      // New class added successfully
      res.json({ success: true });
      console.log("New class added successfully");
    } else {
      // Failed to add the class
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error adding a new class to MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get popular Classes
app.get("/api/classes/popular", async (req, res) => {
  try {
    // Retrieve the top 6 classes based on the number of students from the MongoDB collection
    const popularClasses = await client
      .db("picture_capture_camp_data")
      .collection("classes")
      .find()
      .sort({ students: -1 })
      .limit(6)
      .toArray();

    // Send the popular classes as the response
    res.json(popularClasses);
  } catch (error) {
    console.error("Error retrieving popular classes from MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Popular Instructors
app.get("/api/instructors/popular", async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: "classes",
          localField: "_id",
          foreignField: "instructorId",
          as: "classes",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          image: 1,
          totalStudents: { $sum: "$classes.students" },
        },
      },
      {
        $sort: { totalStudents: -1 },
      },
      {
        $limit: 6,
      },
    ];

    const popularInstructors = await client
      .db("picture_capture_camp_data")
      .collection("instructors")
      .aggregate(pipeline)
      .toArray();

    res.json(popularInstructors);
  } catch (error) {
    console.error("Error retrieving popular instructors from MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update User Role API
app.patch("/user/role/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: role,
      },
    };

    const usersCollection = client
      .db("picture_capture_camp_data")
      .collection("users");

    const result = await usersCollection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1) {
      // Role updated successfully
      console.log("User role updated successfully");
      return res.json({ success: true });
    } else {
      // Failed to update the role
      return res.json({ success: false });
    }
  } catch (error) {
    console.error("Error updating user role in MongoDB:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Is User Admin
app.get("/users/admin/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email;
    const usersCollection = client
      .db("picture_capture_camp_data")
      .collection("users");

    const query = { email: email };
    const user = await usersCollection.findOne(query);

    if (!user) {
      res.status(404).send({ error: "User not found" });
      return;
    }

    const isAdmin = user.role === "admin";
    res.status(200).send({ admin: isAdmin });
  } catch (error) {
    console.error("Error in /users/admin/:email:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Is User instructor
app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email;
    const usersCollection = client
      .db("picture_capture_camp_data")
      .collection("users");

    const query = { email: email };
    const user = await usersCollection.findOne(query);

    if (!user) {
      res.status(404).send({ error: "User not found" });
      return;
    }

    const isInstructor = user.role === "instructor";
    res.status(200).send({ instructor: isInstructor });
  } catch (error) {
    console.error("Error in /users/instructor/:email:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
