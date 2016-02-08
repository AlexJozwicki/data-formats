module.exports = {
    entry: [ './src/index.js' ], // karma will set this
    output: {
        path: './commonjs2',
        filename: 'index.js',
        library: 'data-formats',
        libraryTarget: 'commonjs2'
    },
    resolve: {
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loaders: ['babel'],
            }
        ]
    },
    externals: []
}
