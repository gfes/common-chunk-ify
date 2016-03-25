/* Created by tommyZZM on 2016/3/21. */
"use strict"

const cwd = process.cwd();
const path = require("path")
const through = require("through2");
const pack = require('browser-pack');
const labele = require('labeled-stream-splicer');
const combine = require('stream-combiner');
const depsTopoSort = require('deps-topo-sort');
const reverse = require('reversepoint');
const nub = require("nub");
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

const EVENT = {
    "chunk":"bundle file"
}

const globalDefine = 'typeof global !== "undefined" ? global : '
    + 'typeof self !== "undefined" ? self : '
    + 'typeof window !== "undefined" ? window : {}'

function plugin( b, options ){
    options = Object.assign({
        map:{}
        ,commonName:"common.js"
        ,requireName:"BROWSER_COMMON_REQUIRE"
        ,common:true
    },options)
    let map = Object.keys(options.map).reduce((object,curr)=>{
        object[path.resolve(cwd,curr)] = options.map[curr];
        return object
    },{});

    let packOpts = Object.assign({} ,b._options, {
        raw: true
    });

    b.on("reset",steupPipeline);
    steupPipeline();

    function steupPipeline() {

        let entry_rows = [];
        let rowLabelMap = {};
        let makeCommon = !!options.common;

        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            if(row.file){
                entry_rows.push(row)
            }
            next(null,row)
        },function (end) {

            if(entry_rows.length===1){
                makeCommon = false;
            }

            if(!makeCommon){
                return end();
            }

            var pipelines = entry_rows.reduce(function (object,row) {
                let file = row.file;
                let output = map[file] || path.basename(file);
                let create = ()=>{
                    let pipeline = labele.obj([
                        'pack', [ pack(packOpts) ],
                        'wrap', []
                    ]);
                    let bundled = pipeline.pipe(source(output))
                        .pipe(buffer())
                        .pipe(through.obj((file,enc,next)=>{
                            file.contents = new Buffer(
                                importRequireName(file.contents.toString()
                                    ,options.requireName))
                            next(null,file);
                        }));

                    b.emit(EVENT.chunk,bundled);

                    return pipeline;
                };
                object[file] = create;
                return object
            },{});

            let pipelinesInput = Object.keys(pipelines).reduce((object,key)=>{
                let p = pipelines[key]();
                let input = through.obj()
                input.pipe(p)
                object[key] = input
                return object;
            },{})
            
            let common = checkCommon(pipelinesInput,rowLabelMap)

            // b._bpack.hasExports = true;
            b._bpack.externalRequireName = options.requireName;
            b.pipeline.get('pack').unshift(common);

            end();
        }))

        b.pipeline.get('label').push(through.obj(function(row, enc, next) {
            rowLabelMap[row.id] = path.resolve(cwd, row.file);
            next(null, row);
        }));

        b.pipeline.get('wrap').push(combine(
            source(options.commonName)
            ,buffer()
            ,through.obj(function (file, enc, next) {
                b.emit(EVENT.chunk,this);
                let mapkeys = Object.keys(map);
                if(!makeCommon){
                    let filename = "bundle.js"
                    if(mapkeys.length>0){
                        filename = map[mapkeys[0]];
                    }else {
                        filename = path.basename(entry_rows[0].file);
                    }

                    file.path = path.join(path.dirname(file.path), filename);
                    file.common = true;
                }else{
                    file.contents = new Buffer(exportRequireName(file.contents,options.requireName));
                }
                
                return next(null,file);
            })
            ,through.obj((file,enc,next)=>{
                return next(null,file.contents);
            },function (flush) {
                this.push(null);
                flush()
            })
        ))

    }

    function importRequireName(bufConcated,requireName) {
        return "(function(global){ \nvar require = global."+requireName+ "" +
            ";\n"+bufConcated+"})("+globalDefine+");";
    }

    function exportRequireName(bufConcated,requireName) {
        return "(function(global){ if(typeof module!== 'undefined'){module.exports = {};global=module.exports;} " +
            "\nglobal."+requireName+ "" +
            "=("+bufConcated+")})("+globalDefine+");";
    }
    
    function checkCommon(pipelines,rowLabelMap) {
        // var fr = new Factor(files, {});

        let reliesMap = {};
        let ensuredCommons = {};

        return combine(depsTopoSort(), reverse()/**倒序**/, through.obj(function(row,enc,next){
            let file = getFilepathById(row.id);
            let isEntry = !!pipelines[file];
            let relied = nub(reliesMap[row.id] || [])

            if(isEntry && file){
                relied.push(file);
            }
            // console.log("relied",relied)
            relied.forEach(addGroups)

            if(!!ensuredCommons[row.id] || isCommon(relied)){
                ensuredCommons[row.id] = true;
                this.push(row);
            }else {
                relied.forEach(rely=>{
                    let pipeline = pipelines[rely];
                    if(!!pipeline){
                        pipeline.push(row)
                    }
                })
            }
            // console.log(isCommon(relied),reliesMap,file)

            return next();

            function addGroups (gid) {
                // console.log("addGroups",gid)
                Object.keys(row.deps || {}).forEach(function (file) {
                    var id = row.deps[file];
                    // console.log("id",id)
                    var g = reliesMap[id];
                    if (!g) g = reliesMap[id] = [];
                    g.push(gid);
                });
            }
        },function (end) {
            Object.keys(pipelines).forEach(k=>{
                pipelines[k].push(null);
            })
            return end()
        }), reverse());

        function isCommon(relied) {
            return relied.length>1 || relied.length===0
        }

        function getFilepathById(id) {
            return rowLabelMap[id]
        }
    }
}

module.exports = plugin;
