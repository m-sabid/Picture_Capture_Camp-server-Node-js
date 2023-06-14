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

    // Collections
    const usersCollection = client
    .db("picture_capture_camp_data")
    .collection("users");



        // JWT verification middleware
        const verifyJWT = (req, res, next) => {
          const authorization = req.headers.authorization;
          if (!authorization) {
            return res
              .status(401)
              .send({ error: true, message: "unauthorized access" });
          }
          // bearer token
          const token = authorization.split(" ")[1];
    
          jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
              return res
                .status(401)
                .send({ error: true, message: "unauthorized access" });
            }
            req.decoded = decoded;
            next();
          });
        };
    
        // Admin verification middleware
        const verifyAdmin = async (req, res, next) => {
          const email = req.decoded.email;
          const query = { email: email };
          const user = await usersCollection.findOne(query);
          if (user?.role !== "admin") {
            return res
              .status(403)
              .send({ error: true, message: "forbidden message" });
          }
          next();
        };



    app.get("/", (req, res) => {
      res.send("Running...");
    });

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
      res.json({ token });
    });


       // Users related APIs
       app.post("/users", async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
  
        if (existingUser) {
          return res.json({ message: "User already exists" });
        }
  
        const result = await usersCollection.insertOne(user);
        res.json(result);
      });
  
      app.get("/users", async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.json(result);
      });
  
      app.get("/users/admin/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.json({ admin: false });
        }
  
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.json(result);
      });
  
      app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.json({ instructor: false });
        }
  
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { instructor: user?.role === "instructor" };
        res.json(result);
      });
  
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
