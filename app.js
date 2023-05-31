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






require('dotenv').config()

let mongo_user = process.env.MONGO_USER;
let mongo_pass = process.env.MONGO_PASS;
const mongo_url = `mongodb+srv://${mongo_user}:${mongo_pass}@hornymath.aumknw5.mongodb.net/?retryWrites=true&w=majority`


//Express configs
app.use(flash());

app.use(express.urlencoded({ extended: true }));
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




console.log(mongo_url)

mongoose.connect(mongo_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Mongo Connection Open!!!");
}).catch(err => {
    console.log("Mongo Connection Error!");
    console.log(err);
});


app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});



app.get('/login', (req, res) => {
    res.render('user/login');
}
);

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), async (req, res) => {
    res.redirect('/dashboard');
})

app.get('/register', async (req, res) => {
    res.render('user/register');
}
);

app.get('/dashboard', async (req, res) => {
    //login for me

    res.render('user/dashboard');
});

app.post('/register', async (req, res) => {
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
        return res.redirect('/dashboard');
    });


});

app.get('/logout', (req, res) => {
    req.logout(
        function (err) {
            if (err) {
                req.flash('error', "Something went wrong");
                res.redirect('/dashboard');
            } else {
                req.flash('success', 'Goodbye!');
                res.redirect('/login');
            }
        }

    );

});


app.use("*", (req, res, next) => {
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