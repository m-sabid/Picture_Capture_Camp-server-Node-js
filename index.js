const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.SECRET_KEY_PAYMENT);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensure that the client will close when you finish/error
    // await client.close();
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

run().catch(console.dir);
