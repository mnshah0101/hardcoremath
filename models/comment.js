//comment model for mongoose database
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


const CommentSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now },
    solution: { type: Schema.Types.ObjectId, ref: 'Solution' }

});


let Comment = mongoose.model('Comment', CommentSchema); // Create a Comment model
module.exports = Comment; // Export Comment model
