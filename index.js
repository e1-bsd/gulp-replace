'use strict';

var Transform = require('readable-stream/transform');
var rs = require('replacestream');
var istextorbinary = require('istextorbinary');
var lodash = require('lodash');

module.exports = function(search, replacement, options) {
  return new Transform({
    objectMode: true,
    transform: function(file, enc, callback) {
      var replacementWrap = wrapReplacement(replacement, file);

      if (file.isNull()) {
        return callback(null, file);
      }

      function doReplace() {
        if (file.isStream()) {
          file.contents = file.contents.pipe(rs(search, replacementWrap));
          return callback(null, file);
        }

        if (file.isBuffer()) {
          if (search instanceof RegExp) {
            file.contents = new Buffer(String(file.contents).replace(search, replacementWrap));
          }
          else {
            var chunks = String(file.contents).split(search);

            var result;
            if (typeof replacementWrap === 'function') {
              // Start with the first chunk already in the result
              // Replacements will be added thereafter
              // This is done to avoid checking the value of i in the loop
              result = [ chunks[0] ];

              // The replacement function should be called once for each match
              for (var i = 1; i < chunks.length; i++) {
                // Add the replacement value
                result.push(replacementWrap(search));

                // Add the next chunk
                result.push(chunks[i]);
              }

              result = result.join('');
            }
            else {
              result = chunks.join(replacementWrap);
            }

            file.contents = new Buffer(result);
          }
          return callback(null, file);
        }

        callback(null, file);
      }

      if (options && options.skipBinary) {
        istextorbinary.isText(file.path, file.contents, function(err, result) {
          if (err) {
            return callback(err, file);
          }

          if (!result) {
            callback(null, file);
          } else {
            doReplace();
          }
        });

        return;
      }

      doReplace();
    }
  });
};

function wrapReplacement(replacement, file) {
  if (typeof replacement !== 'function') {
    return replacement;
  }

  return function replacementWrap() {
    var argsArray = lodash.values(arguments);
    var args = [file];
    argsArray.forEach((value) => {
      args.push(value);
    });
    return replacement.apply(this, args);
  };
}
