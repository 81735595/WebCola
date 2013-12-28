module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-qunit');
 
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        typescript: {
            base: {
                src: ['WebCola/src/*.ts'],
                dest: 'WebCola/compiledtypescript.js',
                options: {
                    module: 'amd',
                    target: 'es5',
                    sourcemap: false
                }
            }
        },
        uglify: {
            dist: {
                options: {
                    //sourceMap: 'WebCola/cola.min.map',
                    //sourceMapIn: 'WebCola/compiledtypescript.js.map',
                    //sourceMapRoot: 'WebCola'
                },
                files: {
                    'WebCola/cola.v1.min.js': ['WebCola/compiledtypescript.js', 'WebCola/src/d3adapter.js', 'WebCola/src/rbtree.js']
                }
            }
        },
        qunit: {
            all: ['WebCola/test/*.html']
        }
    });
 
    grunt.registerTask('default', ['typescript', 'uglify', 'qunit']);
 
}
