const express = require('express')
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        // 'http://localhost:5173',
        'https://job-flnder.web.app',
        'https://job-flnder.firebaseapp.com/'


    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tqyfr7x.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middlewares 
const logger = (req, res, next) => {
    console.log('log: info', req.method, req.url);
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    // console.log('token in the middleware', token);
    // no token available 
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const JobsCollection = client.db('JobFinderDB').collection(' jobInformation');
        const bookingsCollection = client.db('JobFinderDB').collection('bookings');


        // auth related  Code 
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        // step-1 jobs post

        app.post('/jobs', async (req, res) => {
            const newJobs = req.body;
            console.log(newJobs)

            // step-4 
            const result = await JobsCollection.insertOne(newJobs);
            res.send(result);
        })

        // step-2 get jobs

        app.get('/jobs', async (req, res) => {
            const category = req.query.category;

            const query = category ? { category } : {};
            const cursor = JobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/JobByEmail', async (req, res) => {

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await JobsCollection.find(query).toArray();
            res.send(result);
        })

        // update job

        app.get('/JobByEmail/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await JobsCollection.findOne(query);
            res.send(result)

        })


        app.put('/JobByEmail/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedJob = req.body;
            console.log('updated job ', updatedJob);
            const jobUpdate = {
                $set: {

                    // const updateJob = { title, email, company, dateline, posting, minPrice, maximum, description, category, short }

                    title: updatedJob.title,
                    dateline: updatedJob.dateline,
                    company: updatedJob.company,
                    posting: updatedJob.posting,
                    minPrice: updatedJob.minPrice,
                    maximum: updatedJob.maximum,
                    description: updatedJob.description,
                    short: updatedJob.short,
                    category: updatedJob.category

                }

            }
            console.log(jobUpdate);
            const result = await JobsCollection.updateOne(filter, jobUpdate, options);

            res.send(result);
        })
        //  delete job

        app.delete('/JobByEmail/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await JobsCollection.deleteOne(query);
            res.send(result);
        })


        app.get('/Jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const options = {
                projection: {
                    title: 1, maximum: 1, minPrice: 1, email: 1, description: 1, dateline
                        : 1
                },
            };
            const result = await JobsCollection.findOne(query, options);
            res.send(result);
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/bookings', logger, async (req, res) => {
            console.log(req.query.email)
            // if (req.query.email != req.user.email) {
            //     return res.status(403).send({ message: ' forbidden access' })
            // }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/BidRequest', async (req, res) => {

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })


        // Update your Express server to handle the accept and reject actions.
        app.put('/bookings/:id/accept', async (req, res) => {
            const id = req.params.id;
            try {
                const query = { _id: new ObjectId(id) };
                const booking = await bookingsCollection.findOne(query);

                if (!booking) {
                    return res.status(404).json({ message: "Booking not found" });
                }

                // Update the booking status to 'Accepted'.
                const result = await bookingsCollection.updateOne(query, { $set: { Status: "Accepted" } });
                if (result.modifiedCount === 1) {
                    return res.json({ message: "Accepted" });
                } else {
                    return res.status(500).json({ message: "Failed to update booking" });
                }
            } catch (error) {
                console.error(error);
                return res.status(500).json({ message: "Server error" });
            }
        });

        app.put('/bookings/:id/reject', async (req, res) => {
            const id = req.params.id;
            try {
                const query = { _id: new ObjectId(id) };
                const booking = await bookingsCollection.findOne(query);

                if (!booking) {
                    return res.status(404).json({ message: "Booking not found" });
                }

                // Update the booking status to 'Cancel'.
                const result = await bookingsCollection.updateOne(query, { $set: { Status: "Cancel" } });
                if (result.modifiedCount === 1) {
                    return res.json({ message: "Rejected" });
                } else {
                    return res.status(500).json({ message: "Failed to update booking" });
                }
            } catch (error) {
                console.error(error);
                return res.status(500).json({ message: "Server error" });
            }
        });





        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
// middleware

app.use(cors());
app.use(express.json());




app.get('/', (req, res) => {
    res.send('Job Finder  server is running ')
})

app.listen(port, () => {
    console.log(`Job Finder   server is running on port ${port}`)
})