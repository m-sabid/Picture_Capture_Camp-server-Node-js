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

      // popular-instructors API
    app.get("/api/popular-instructors", async (req, res) => {
      try {
        const instructors = await usersCollection
          .find({ role: "instructor" })
          .toArray();
        const popularInstructors = [];

        for (const instructor of instructors) {
          const classes = await classCollection
            .find({ instructorEmail: instructor.email })
            .toArray();
          let totalStudents = 0;

          if (classes.length > 0) {
            for (const classItem of classes) {
              totalStudents += classItem.students;
            }
          }

          popularInstructors.push({
            name: instructor.name,
            email: instructor.email,
            photoURL: instructor.photoURL,
            totalClasses: classes.length,
            totalStudents: totalStudents,
          });
        }

        popularInstructors.sort((a, b) => b.totalStudents - a.totalStudents);
        popularInstructors.splice(6);

        res.json(popularInstructors);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: true, message: "An error occurred" });
      }
    });
  
     // Class related APIs
     app.post("/api/classes", async (req, res) => {
      try {
        const { title, seats, price, image, instructorName, instructorEmail } =
          req.body;

        // Parse seats and price as numbers
        const parsedSeats = parseInt(seats);
        const parsedPrice = parseFloat(price);

        // Save the new class to MongoDB
        const result = await manageClassesCollection.insertOne({
          title,
          seats: parsedSeats,
          price: parsedPrice,
          image,
          instructorEmail,
          instructorName,
          status: "pending",
          feedback: "",
          students: 0,
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

    app.get("/api/all-classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.json(result);
    });

    app.get("/api/classes", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await manageClassesCollection.find().toArray();
      res.json(result);
    });

    app.patch("/api/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status, feedback } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {};

        if (status) {
          updateDoc.$set = { status };
        }

        if (feedback) {
          updateDoc.$set = { feedback };
        }

        const result = await manageClassesCollection.updateOne(
          filter,
          updateDoc
        );

        console.log(result);

        if (result.modifiedCount === 1) {
          console.log("Class status updated successfully");

          if (feedback) {
            await classCollection.updateOne(filter, { $set: { feedback } });
          }

          if (status === "approved") {
            const classData = await manageClassesCollection.findOne(filter);
            await classCollection.insertOne(classData);
          } else if (status === "denied") return res.json({ success: true });
        } else {
          return res.json({ success: false });
        }
      } catch (error) {
        console.error("Error updating class status in MongoDB:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.delete("/api/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };

        const result = await classCollection.deleteOne(filter);

        console.log(result);

        if (result.deletedCount === 1) {
          console.log("Class deleted successfully");
          return res.json({ success: true });
        } else {
          return res.json({ success: false });
        }
      } catch (error) {
        console.error("Error deleting class from MongoDB:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/api/popular-classes", async (req, res) => {
      try {
        const popularClasses = await classCollection
          .find()
          .sort({ students: -1 })
          .limit(6)
          .toArray();

        res.json(popularClasses);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: true, message: "An error occurred" });
      }
    });

    // Cart related routes
    app.post("/api/classes/cart", async (req, res) => {
      const item = req.body;
      const existingItem = await cartCollection.findOne(item);
      if (existingItem) {
        return res.status(400).json({ message: "Item already exists" });
      }

      const result = await cartCollection.insertOne(item);
      res.json(result);
    });

    app.get("/api/all-carts", async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.json(result);
    });

    app.delete("/api/carts/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };

        const result = await cartCollection.deleteOne(filter);

        console.log(result);

        if (result.deletedCount === 1) {
          console.log("Class deleted from cart successfully");
          return res.json({ success: true });
        } else {
          return res.json({ success: false });
        }
      } catch (error) {
        console.error("Error deleting class from MongoDB:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

     // payment related api
     app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/api/payments", verifyJWT, async (req, res) => {
      try {
        const payment = req.body;
        const { id, classId } = payment;

        console.log(classId, id);

        // Update the class collection to increment the students count
        await classCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $inc: { students: 1, seats: -1 } }
        );

        // Insert the payment into the payment collection
        const insertResult = await paymentCollection.insertOne(payment);

        // Remove the class from the user's cart
        const deleteResult = await cartCollection.deleteOne({
          _id: new ObjectId(id),
        });

        // Insert the enrolled class into the enrolled collection
        const enrolledClass = await enrolledCollection.insertOne({
          _id: new ObjectId(classId),
        });

        res.send({ insertResult, deleteResult });
      } catch (error) {
        console.error("Error processing payment:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });


      // Enrolled Classes Api
      app.get("/api/enrolled", async (req, res) => {
        const result = await paymentCollection.find().toArray();
        res.json(result);
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
