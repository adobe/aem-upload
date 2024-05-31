const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/exports.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [{
      test: /\.(?:js|mjs|cjs)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-env', { targets: 'defaults' }],
          ],
        },
      },
    }],
  },
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      fs: false,
    },
  },
};
