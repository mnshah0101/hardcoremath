const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const engine = require('ejs-mate');
const path = require('path');
const User = require('./models/User');


require('dotenv').config()

let mongo_user = process.env.MONGO_USER;
let mongo_pass = process.env.MONGO_PASS;

//Express configs
app.use(express.urlencoded({ extended: true }));
app.engine('ejs', engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

mongo_url = `mongodbsrv://${mongo_user}<${mongo_pass}>@hornymath.aumknw5.mongodb.net/?retryWrites=true&w=majority`



mongoose.connect('mongodb://127.0.0.1:27017/hornymath')
    .then(() => console.log('Connected!'));


app.get('/login', (req, res) => {
    res.render('user/login');
}
);

app.get('/register', (req, res) => {
    res.render('user/register');
}
);

app.post('/register', async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let username = req.body.username;
    let user = new User({ email: email, username: username });
    await User.register(user, password)
    res.redirect('/login');

});





app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
}
);