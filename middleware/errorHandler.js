function errorHandler (){
    console.log(`an error from the error handler`)
    const errObj = new Error(`logical error `)
    next(errObj)
}
