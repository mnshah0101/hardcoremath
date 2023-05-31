const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const engine = require('ejs-mate');
const path = require('path');
const User = require('./models/User');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const ExpressError = require('./utils/ExpressError');
const CatchAsync = require('./utils/CatchAsync');
const methodOverride = require('method-override');
const Problem = require('./models/problem');
const cron = require('node-cron');
const multer = require('multer');
const multers3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3')







require('dotenv').config()

let mongo_user = process.env.MONGO_USER;
let mongo_pass = process.env.MONGO_PASS;
const mongo_url = `mongodb+srv://${mongo_user}:${mongo_pass}@hornymath.aumknw5.mongodb.net/?retryWrites=true&w=majority`


//Express configs
app.use(flash());

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

//session configs
app.use(session({
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: mongo_url, // replace with your MongoDB connection string
        collectionName: 'sessions', // optional; default is 'sessions'
    }),
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

//Pasport Configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());




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

//Function to Run When New Problem is Posted
let newProblem = async () => {
    await User.updateMany({ havePosted: false }, { $set: { streak: 0 } })
    await User.updateMany({}, { $set: { hasPosted: false } });

}


//Cron Job to Run Every Day at 12:00 AM
cron.schedule('0 0 * * *', () => {
    // Your task or function to be executed every day at 12:00 AM
    newProblem();
});


//Check is user has posted a solution
let checkPosted = async (req, res, next) => {
    let user = await User.findById(req.user._id);
    if (user.hasPosted) {
        return next();
    } else {
        return res.redirect('/problem');
    }
}


let checkedLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be signed in');
        return res.redirect('/login');
    }
    return next();
}



app.use((req, res, next) => {
    console.log('this is the session')
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});



app.get('/login', CatchAsync(async (req, res) => {
    res.render('user/login');
}
));

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), async (req, res) => {
    res.redirect('/problem');
})

app.get('/register', CatchAsync(async (req, res) => {
    res.render('user/register');
}
));

app.get('/problem', async (req, res) => {
    //login for me

    res.render('user/problem');
});

app.post('/register', CatchAsync(async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let username = req.body.username;
    let user = new User({ email: email, username: username });
    try {
        await User.register(user, password)
    } catch (e) {
        req.flash('error', e.message);
        return res.redirect('/register');
    }
    //login for me
    passport.authenticate('local')(req, res, function () {
        return res.redirect('/problem');
    });


}));

app.get('/logout', CatchAsync(async (req, res) => {
    req.logout(
        function (err) {
            if (err) {
                req.flash('error', "Something went wrong");
                res.redirect('/problem');
            } else {
                req.flash('success', 'Goodbye!');
                res.redirect('/login');
            }
        }

    );

}));

app.post('/solution', CatchAsync(async (req, res) => {
    console.log(req.body);
    return "hello"
}));


app.get('/', async (req, res) => {
    res.render('login');
});

app.use("*", async (req, res, next) => {
    next(new ExpressError("Page not found", 404));

});

app.use((err, req, res, next) => {
    const { status = 500, message = "Something went wrong" } = err;
    res.render('error', { status, err });
});




app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
}
);