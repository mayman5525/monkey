const form = require('../modules/form')
module.exports({
    getFormUsers(){

    },
    submitForm(data){
        const data = req.body()
        new form(data).save()
    }
})