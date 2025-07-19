const mongoose = require('mongoose')
const { Schema } = mongoose
const formSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    phone_number:{
        type:Number,
        required:true
        
    },
    email:{
        type:String,
        required:false
        },
    })

    
    module.exports(formSchema)