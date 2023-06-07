const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());
app.use(express.json());
dotenv.config();

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
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// JWT token
app.post('/jwt', (req, res) => {
  // Assuming you have received the email in the request body
  const { email } = req.body;

  // Create a JWT token with the email as the payload
  const token = jwt.sign({ email }, process.env.SECRET_KEY);

  // Send the JWT token as the response
  res.send({ token });
});

// API endpoint for saving user data
app.post('/users', async (req, res) => {
  try {
    const { name, email, gender, phoneNumber, address } = req.body;

    // Save user data to MongoDB
    const result = await client.db("your_database_name").collection("users").insertOne({
      name,
      email,
      gender,
      phoneNumber,
      address,
    });

    if (result.insertedId) {
      // User data saved successfully
      res.json({ success: true });
      console.log("User data saved successfully")
    } else {
      // Failed to save user data
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error saving user data to MongoDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
