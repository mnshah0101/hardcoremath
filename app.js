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
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const Solution = require('./models/solution');


aws.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    region: 'us-east-1'
});

const s3 = new aws.S3();


const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'hornymath-pdf-bucket',
        contentType: multerS3.AUTO_CONTENT_TYPE,

        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const date = new Date();
            const formattedDate = date.toISOString().split('T')[0];
            const fileName = `${formattedDate}_${file.originalname}`;
            cb(null, fileName);
        }
    })
});





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



const createSolution = async (pdf_url, problem, user) => {
    let newSolution = new Solution({ pdf_url: pdf_url, problem: problem, user: user });
    await newSolution.save();
    return newSolution;
}

const findTodayProblem = async () => {
    let date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let todayProblem = await Problem.findOne({ date: today });
    return todayProblem;
}




app.use((req, res, next) => {
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

app.get('/problem/create', checkedLoggedIn, CatchAsync(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set the time to the start of the day

    let problems = await Problem.find({ date: { $gte: today } });
    res.render('problem/create', { problems });
}));

app.get('/problem', async (req, res) => {
    const problem = await findTodayProblem();
    const user = req.user;
    if (problem) {
        return res.render('user/problem', { problem, user });
    } else {
        return res.render('user/problem', { problem: null, user });
    }
    //login for me

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

app.post('/solution', upload.single('solution_upload'), CatchAsync(async (req, res) => {
    const file = req.file;
    const fileUrl = file.location;
    const problem = await findTodayProblem();
    let user = await User.findById(req.user._id);
    user.hasPosted = true;
    user.streak += 1;
    await user.save();


    const solution = await createSolution(fileUrl, problem, user);
    problem.solutions.push(solution);
    await problem.save();




    return res.redirect('/problem');
}));



app.post('/problem/create', checkedLoggedIn, CatchAsync(async (req, res) => {
    let problem = req.body.problem;
    let difficulty = req.body.difficulty;
    let year = req.body.year;
    let month = req.body.month;
    let day = req.body.day;
    let date = new Date(year, month - 1, day);
    //if there is a post already for that day, delete that post
    let problemToDelete = await Problem.findOne({ date: date });
    if (problemToDelete) {
        await Problem.findByIdAndDelete(problemToDelete._id);
    }

    let problemTitle = req.body.title;
    let image = req.body.image;
    let newProblem = new Problem({ problem: problem, difficulty: difficulty, date: date, problemTitle: problemTitle, image: image });
    await newProblem.save();
    res.redirect('/problem/create');
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