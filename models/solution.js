const mongoose = require('mongoose'); // Import mongoose
const Schema = mongoose.Schema; // Create a Schema

const SolutionSchema = new Schema({
    pdf_url: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now()
    },
    problem: {
        type: Schema.Types.ObjectId,
        ref: 'Problem',
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    upvotes: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    ],

    key: {
        type: String,
        required: true
    }



});


let Solution = mongoose.model('Solution', SolutionSchema); // Create a User model
module.exports = Solution; // Export User model
