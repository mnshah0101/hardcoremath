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
const Comment = require('./models/comment');

//require dotenv if not in production
if (process.env.NODE_ENV !== "production") {
    require('dotenv').config()
}

const mongo_user = process.env.MONGO_USER;
const mongo_pass = process.env.MONGO_PASS;
const SESSION_NAME = process.env.SESSION_NAME;
const SESSION_SECRET = process.env.SESSION_SECRET;
const mongo_url = `mongodb+srv://${mongo_user}:${mongo_pass}@hornymath.aumknw5.mongodb.net/?retryWrites=true&w=majority`
const aws_secret_key = process.env.AWS_SECRET_ACCESS_KEY;
const aws_access_key = process.env.AWS_ACCESS_KEY_ID;



aws.config.update({
    secretAccessKey: aws_secret_key,
    accessKeyId: aws_access_key,
    region: 'us-east-1'

});

const s3 = new aws.S3({
    params: {
        Bucket: 'hornymathbucket',
        ServerSideEncryption: "AES256",
        ContentType: 'application/pdf'
    }
});


const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: "hornymathbucket",
        contentType: multerS3.AUTO_CONTENT_TYPE,

        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const date = new Date();
            console.log(date);
            const fileName = `${date}_${file.originalname}`;
            cb(null, fileName);
        }
    })
});






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
    name: SESSION_NAME,
    secret: SESSION_SECRET,
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



let checkIfAdmin = async (req, res, next) => {
    if (req.user.role == 'admin') {
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
    console.log("hello")
    return next();
}



const createSolution = async (pdf_url, problem, user, key) => {
    let newSolution = new Solution({ pdf_url: pdf_url, problem: problem, user: user, key: key });
    await newSolution.save();
    return newSolution;
}

const findTodayProblem = async () => {
    let date = new Date();
    let today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let todayProblem = await Problem.findOne({ date: today }).populate('solutions');
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

app.get('/problem', checkedLoggedIn, async (req, res) => {
    console.log("hello")
    const problem = await findTodayProblem();
    const user = req.user;
    if (problem) {
        return res.render('user/problem', { problem, user });
    } else {
        return res.render('user/problem', { problem: null, user });
    }
    //login for me

});

app.get('/problem/create', checkedLoggedIn, checkIfAdmin, CatchAsync(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set the time to the start of the day

    let problems = await Problem.find({ date: { $gte: today } });
    res.render('problem/create', { problems });
}));



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
    console.log(file);
    const fileUrl = file.location;
    const problem = await findTodayProblem();
    const key = file.key;
    let user = await User.findById(req.user._id);
    user.hasPosted = true;
    user.streak += 1;
    await user.save();


    const solution = await createSolution(fileUrl, problem, user, key);
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

app.get('/leaderboard', checkedLoggedIn, checkPosted, CatchAsync(async (req, res) => {
    //get today problem
    let todayProblem = await findTodayProblem();


    let solutions = await Solution.find({ problem: todayProblem._id }).populate('user');
    console.log(solutions);
    solutions = solutions.splice(0, 50);
    //sort by upvotes length
    solutions.sort((a, b) => {
        return b.upvotes.length - a.upvotes.length;
    });

    let problem = await findTodayProblem();
    res.render('problem/leaderboard', { solutions, problem });
}));

app.get('/solution/:id', checkedLoggedIn, checkPosted, CatchAsync(async (req, res) => {
    let solution = await Solution.findById(req.params.id);
    let likedUsers = solution.upvotes;
    let user = await User.findById(req.user._id);
    let hasLiked = false;
    if (likedUsers.includes(user._id)) {
        hasLiked = true;
    }

    const bucketName = 'hornymathbucket';
    const key = solution.key;
    const params = {
        Bucket: bucketName,
        Key: key,
        Expires: 3600 // Expiration time in seconds (1 hour in this example)
    };
    const url = s3.getSignedUrl('getObject', params);
    solution.pdf_url = url;
    let comments = await Comment.find({ solution: solution._id }).populate('user');

    res.render('solution/solution', { solution, url, hasLiked, comments });
}));


app.post('/solution/upvote', checkedLoggedIn, checkPosted, CatchAsync(async (req, res) => {
    let solution = await Solution.findById(req.body.solution_id);
    if (solution.upvotes.includes(req.user._id)) {
        //get rid of upvote
        solution.upvotes = solution.upvotes.filter((id) => {
            return id.toString() !== req.user._id.toString();
        });


        await solution.save();

        return res.redirect('/leaderboard');
    }
    solution.upvotes.push(req.user._id);
    await solution.save();
    return res.redirect('/leaderboard');
}));

app.post('/solution/addComment', checkedLoggedIn, checkPosted, CatchAsync(async (req, res) => {
    let comment = req.body.comment;
    let solution_id = req.body.solution_id;
    let user_id = req.user._id;
    let newComment = new Comment({ comment: comment, user: user_id, solution: solution_id });
    await newComment.save();
    res.redirect(`/solution/${solution_id}`);
}));




app.get('/', async (req, res) => {
    res.redirect('/problem');
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