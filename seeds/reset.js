const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Problem = require('../models/problem');
const Solution = require('../models/solution');
const User = require('../models/User');



let mongo_user = process.env.MONGO_USER;
let mongo_pass = process.env.MONGO_PASS;
let admin_pass = process.env.ADMIN_PASS;
let admin_user = process.env.ADMIN_USER;
let admin_email = process.env.ADMIN_EMAIL;

const mongo_url = `mongodb+srv://${mongo_user}:${mongo_pass}@hornymath.aumknw5.mongodb.net/?retryWrites=true&w=majority`
//Mongo Connection
mongoose.connect(mongo_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Mongo Connection Open!!!");
}).catch(err => {
    console.log("Mongo Connection Error!");
    console.log(err);
});

//Clear all database entries
const deleteAll = async () => {
    await Problem.deleteMany({});
    await Solution.deleteMany({});
    await User.deleteMany({});
}

//create admin user
const createAdmin = async () => {
    const admin = new User({
        email: admin_email,
        username: admin_user,
        profilePicture: "",
        hasPosted: false,
        userScore: 0,
        streak: 0,
        posts: [],
        followers: [],
        following: [],
        role: "admin"
    });
    await User.register(admin, admin_pass);
}



const seedDB = async () => {
    await deleteAll();
    await createAdmin();
}

seedDB().then(() => {
    mongoose.connection.close();
    console.log("Database Reset!");
}
);