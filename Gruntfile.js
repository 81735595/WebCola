module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-typescript');
	grunt.loadNpmTasks('grunt-contrib-uglify');
 
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        typescript: {
            base: {
                src: ['webcola/*.ts'],
                dest: 'webcola/compiledtypescript.js',
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
                    //sourceMap: 'webcola/cola.min.map',
                    //sourceMapIn: 'webcola/compiledtypescript.js.map',
                    //sourceMapRoot: 'webcola'
                },
                files: {
                    'webcola/cola.v1.min.js': ['webcola/compiledtypescript.js', 'webcola/d3adapter.js', 'webcola/rbtree.js']
                }
            }
        }
    });
 
    grunt.registerTask('default', ['typescript', 'uglify']);
 
}
