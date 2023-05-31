const mongoose = require('mongoose'); // Import mongoose
const Schema = mongoose.Schema; // Create a Schema
const passport = require('passport-local-mongoose'); // Import passport-local-mongoose (for authentication

const UserSchema = new Schema({ // Create a UserSchema
    email: {
        type: String,
        required: true,
        unique: true
    },

    profilePicture: {
        type: String,
        default: ""
    },
    hasPosted: {
        type: Boolean,
        default: false
    },
    userScore: {
        type: Number,
        default: 0
    },
    streak: {
        type: Number,
        default: 0
    },
    posts: [
        { type: Schema.Types.ObjectId, ref: 'Post', required: false }
    ],
    followers: [
        { type: Schema.Types.ObjectId, ref: 'User', required: false }
    ],
    following: [
        { type: Schema.Types.ObjectId, ref: 'User', required: false }
    ]
});
UserSchema.plugin(passport); // Add passport-local-mongoose to UserSchema


let User = mongoose.model('User', UserSchema); // Create a User model
module.exports = User; // Export User model
