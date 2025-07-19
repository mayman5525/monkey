module.exports({
    product_name:{
        type: String,
        required: true
        
    },
    product_description:{
        type: String,
        required: false
    },
    product_photo:{
        type:String,
        required: false
    },
    product_price:{
        type: Number,
        required: true
        },
        product_category:{
            type:String,
            required:true
            },
            has_points:{
                type:Boolean,
                required:true,
                default:false
            },

})