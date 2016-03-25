/* Created by tommyZZM on 2016/3/21. */
"use strict"
const path =require("path");
const browserify = require("browserify")
const through = require("through2")
const expect = require("chai").expect;
const self = require("../")

describe('common', function() {
    it("make common",function(done){

        let b = browserify({entries:["a.js","b.js"].map(entry=>"test/resources/"+entry)})
            .plugin(self,{
                map:{
                    "test/resources/a.js":"app.js"
                    ,"test/resources/b.js":"bpp.js"
                }
            })

        let counts = 0
        let filenames = ["app.js","bpp.js","common.js"];

        b.on("bundle file",bundle=> {
            bundle.on("data",file=>{
                console.log("file\n",file.contents.toString())
                counts++;
                filenames = 
                    filenames.filter(filename=>filename !== path.basename(file.path));
            })
        })

        return b.bundle()
            .pipe(through((buf ,enc ,next)=>next(null ,buf),()=>{
                expect(counts).to.be.equal(3);
                expect(filenames.length).to.be.equal(0);
                done()
            }))
    })

    it("one file",function(done){
        let b = browserify({entries:["no.js"].map(entry=>"test/resources/"+entry)})
            .plugin(self)

        let outputname = ""
        b.on("bundle file",bundle=> {
            bundle.on("data",file=>{
                outputname = path.basename(file.path);
            })
        })

        return b.bundle()
            .pipe(through((buf ,enc ,next)=>next(null ,buf),()=>{
                expect(outputname).to.be.equal("no.js");
                done()
            }))
    })
})