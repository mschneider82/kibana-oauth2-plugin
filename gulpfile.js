const gulp = require('gulp');
const vfs = require('vinyl-fs');
const zip = require('gulp-zip');
const rename = require('gulp-rename');
const join = require('path').join;
const package = require('./package.json')

gulp.task('build', function () {
  var deps = Object.keys(package.dependencies || {});
  var buildId = `${package.name}-${package.version}`;

  var files = [
    'package.json',
    'index.js',
    '{lib,public,server,webpackShims}/**/*',
    `node_modules/{${ deps.join(',') }}/**/*`,
  ];

  vfs
    .src(files, { base: '.' })
    .pipe(rename(function nestFileInDir(path) {
      path.dirname = join(buildId, path.dirname);
    }))
    .pipe(zip(`${buildId}.zip`))
    .pipe(vfs.dest(join('.', 'build')));
});
