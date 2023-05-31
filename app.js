const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const engine = require('ejs-mate');


//Express configs
app.use(express.urlencoded({ extended: true }));
app.engine('ejs', engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));


app.get('/login', (req, res) => {
    res.render('login');
}
);

mongoose.connect('mongodb://127.0.0.1:27017/hornymath')
    .then(() => console.log('Connected!'));


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
}
);