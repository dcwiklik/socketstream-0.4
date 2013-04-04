"use strict";

/*
   
   Asset Server
   ------------
   Serve JS, CSS and static files to the client over HTTP, preprocessing them first if required

   TODO: This module is a complete mess and needs scrapping once we know if we're keeping Browserify 2

*/

var fs = require('fs'),
    path = require('path'),
    url = require('url'),
    querystring = require('querystring'),
    Stream = require('stream');


module.exports = function(app, clients, preprocessors, request){

  var sp = request.url.split('/');

  // Serve Assets in Developer Mode
  if (sp[1] == '_ss' && sp[3]) {

    // Get Extension
    var thisUrl = url.parse(request.url);
    var qs = querystring.parse(thisUrl.query);

    // Get Client
    var client = clients[qs.clientId-1];

    // Define output file (a Streams1 object for now)
    var file;

    // Temporary code to trial Browserify 2
    if (sp[3] == 'modules') {

      // Write auto-generated system client file
      var codeGen = require('../client/code_generator')(app);
      fs.writeFileSync(app.root + '/client/app/system.js', codeGen);

      // Bundle files
      var browserify = require('browserify');
      var b = browserify();
      b.add(app.root + '/client/app/' + client.firstModule);
      file = b.bundle({debug: true}, function(err, output){
        if (err) return console.log('module build error', err);
      });

    } else {
  
      // Select mime type
      var mimetype = mimetypes[sp[2]];

      // Serve System JS Code
      if (sp[3] == '_system') {

        file = new Stream();
        file.readable = true;
        process.nextTick(function(){

          var systemLibs = client.browserAssets({type: 'js'}).map(function(asset){
            return fs.readFileSync(asset.filename, 'utf8');
          });

          file.emit('data', systemLibs.join(';').toString());
          file.emit('end');
        });
      
      // Serve Asset File
      } else {

        var fileName = qs.path || sp.slice(4).join('/');
        fileName = path.join(app.root, fileName);
        if (fileName.slice(fileName.length-4) === '.map') fileName = fileName.slice(0, -4) + '.js';
        var ext = fileName.slice(fileName.lastIndexOf('.')+1);
        file = fs.createReadStream(fileName);
        

        // Pre-process if required
        if (preprocessors[ext]) {
          preprocessors[ext].removeAllListeners();
          file = file.pipe(preprocessors[ext]);
        }

      }

    }

    // Overwrite pipe() so we can apply headers. This still feels nasty :(
    var originalPipe = file.pipe.bind(file);
    file.pipe = function(dest, options){
      this.dest = dest;
      if (this.dest.setHeader) {
        this.dest.setHeader('content-type', mimetype);
      }
      originalPipe(dest, options);
    };

    return file;

  }

};

var mimetypes = {
  css: 'text/css',
  js:  'text/javascript'
};