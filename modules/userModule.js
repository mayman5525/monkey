module.exports({
    user_id:{
        type: String,
        required: true

    },
    user_name:{
        type: String,
        required: false
    },
    user_email:{
        type: String,
        required: false
        },
        user_number:{
            type: Number,
            required:true
        },
    is_new:{
        type : Boolean,
        default:true
    },
    has_points:{
        type:Boolean,
        default:false
    }
})